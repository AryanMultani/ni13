const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const Developer = require('./models/Developer');
const Property = require('./models/Property');
const Task = require('./models/Task');
const User = require('./models/User');
const Test = require('./models/Test');
const Career = require('./models/Career');
const multer = require('multer');
const sanitizeHtml = require('sanitize-html');
const { createProxyMiddleware } = require('http-proxy-middleware');



const fs = require('fs');
require('dotenv').config();
const Blog = require('./models/Blog'); // Adjust the path as necessary
const blogRoutes = require('./routes/blog');

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Uploads directory created successfully');
} else {
  console.log('Uploads directory already exists');
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Directory where files will be saved
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // Set file size limit (5 MB)
});

const app = express();
const PORT = process.env.PORT || 3000;
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use('/icons', express.static(path.join(__dirname, 'icons')));
app.use('/reras', express.static(path.join(__dirname, 'reras')));
app.use('/files', express.static(path.join(__dirname, 'uploads')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/property-backend/views', express.static(path.join(__dirname, 'views')));
app.use(express.static('views'));

app.use('/api', createProxyMiddleware({
  target: 'https://demos.ascendoor.com',
  changeOrigin: true,
  pathRewrite: {
      '^/api': '', // remove '/api' prefix when forwarding
  },
}));
// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(session({
  secret: 'your-secret-key', // Change this to a more secure secret
  resave: false,
  saveUninitialized: true,
}));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('template', path.join(__dirname, 'template'));
app.use(express.static(path.join(__dirname, 'views', 'template')));
// Connect to MongoDB
const mongoURI = process.env.MONGODB_URI;

if (!mongoURI) {
  console.error('MongoDB URI is not defined in environment variables');
  process.exit(1);
}

mongoose.connect(mongoURI)
  .then(() => {
    console.log('MongoDB connected successfully');
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });



  app.get('/search', async (req, res) => {
    try {
      const searchQuery = req.query.q ? sanitizeHtml(req.query.q) : '';
      let propertyFilter = {};
  
      if (searchQuery) {
        propertyFilter.$or = [
          { name: { $regex: searchQuery, $options: 'i' } },
          { description: { $regex: searchQuery, $options: 'i' } }
        ];
      }
  
      const matchingProperties = await Property.find(propertyFilter);
      console.log(matchingProperties); // Log for debugging
      res.json(matchingProperties);
    } catch (err) {
      console.error('Error fetching search results:', err); // Log the error
      res.status(500).json({ error: 'Internal Server Error' }); // Send a response
    }
  });
  

// Admin access middleware
const isAdmin = (req, res, next) => {
  if (req.session.isAdmin) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'views', 'verify-code.html'));
};
// Route to display add property form (restricted to admin)
app.get('/add', isAdmin, async (req, res) => {
  try {
    const developers = await Developer.find(); // Assuming 'Developer' is your model
    const property = await Property.find();
    res.render('add', { developers, property });
  } catch (err) {
    res.status(500).send("Error fetching developers");
  }
});

app.get('/addDev', (req, res) => {
  res.render('addDeveloper', { developer: {} }); // Pass an empty object or provide default values
});


app.get('/addTest', (req, res) => {
  res.render('test'); // Pass an empty object or provide default values
});

// Handle adding new property


// Handle adding new developer
app.post('/addTest', upload.single('logo'), async (req, res) => {
  try {
    const { name, longDescription, cityPresent } = req.body;
    const logo = req.file ? req.file.path : ''; // Get file path if file uploaded

    const newTest = new Test({
      logo,
      name,
      longDescription,
      cityPresent,
    });

    await newTest.save();
    console.log(newTest)
    res.redirect('/'); // Redirect to admin or another page
  } catch (err) {
    console.error('Error adding test:', err);
    res.status(500).send('Server Error');
  }
});

// Admin code verification route
app.post('/verify-code', (req, res) => {
  const { code } = req.body;
  const accessCode = '9671'; // Code to access the admin dashboard

  if (code === accessCode) {
    req.session.isAdmin = true;
    res.redirect('/admin');
  } else {
    res.status(401).send('Unauthorized');
  }
});


// Admin dashboard
app.get('/admin', isAdmin, async (req, res) => {
  const { developer, status, search } = req.query; // Get filter parameters

  try {
    let query = {};

    if (developer) {
      query.developer = developer; // Filter by developer ID
    }

    if (status) {
      query.status = status; // Filter by status
    }

    if (search) {
      query.name = new RegExp(search, 'i'); // Search by name (case-insensitive)
    }

    const properties = await Property.find(query);
    const developers = await Developer.find();
    const tasks = await Task.find();
    const users = await User.find();
    const tests = await Test.find(); // Fetch tests data
    const blogs = await Blog.find(); // Fetch blogs data
    const career = await Career.find(); // Fetch blogs data

    res.render('admin-dashboard', {
      properties,
      propCount: properties.length,
      developers,
      deveCount: developers.length,
      users,
      usersCount: users.length,
      tasks,
      tests,
      blogs,
      blogsCount: blogs.length,
      career,
    });
  } catch (err) {
    console.error("Error fetching Data: ", err);
    res.render('admin-dashboard', {
      properties: [],
      propCount: 0,
      developers: [],
      deveCount: 0,
      users: [],
      usersCount: 0,
      tasks: [],
      tests: [],
      blogs: [],
      blogsCount: 0
    });
  }
});


// Route to display edit property form (restricted to admin)
app.get('/admin/edit/property/:id', async (req, res) => {
  try {
    const property = await Property.findById(req.params.id).exec();
    const developers = await Developer.find().exec(); // Fetch all developers
    if (!property) {
      return res.status(404).send('Property not found');
    }
    res.render('editProperty', { property, developers });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
});

// Route to display edit developer form (restricted to admin)
app.get('/admin/edit/developer/:id', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const developer = await Developer.findById(id);
    if (!developer) {
      return res.status(404).send('Developer not found');
    }
    res.render('editDeveloper', { developer });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});
app.get('/admin/edit/test/:id', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const test = await Test.findById(id);
    if (!test) {
      return res.status(404).send('Test not found'); // Updated error message
    }
    res.render('editTest', { test });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

app.post('/admin/update/test/:id', isAdmin, upload.single('logo'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, longDescription, cityPresent } = req.body;
    const logo = req.file ? req.file.path : req.body.existingLogo; // Handle file or keep existing logo

    const updatedTest = await Test.findByIdAndUpdate(id, {
      logo,
      name,
      longDescription,
      cityPresent,
    }, { new: true });

    if (!updatedTest) {
      return res.status(404).send('Test not found');
    }
    res.redirect('/');
  } catch (err) {
    console.error(err); // Log the error for debugging
    res.status(500).send('Server Error');
  }
});

// Handle deletion of a property or developer
app.post('/admin/delete/:id', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if the ID exists in any collection before deleting
    const propertyDeletion = Property.findById(id);
    const developerDeletion = Developer.findById(id);
    const testDeletion = Test.findById(id);
    const blogDeletion = Blog.findById(id);
    const careerDeletion = Career.findById(id);

    // Wait for all the checks to finish
    const [property, developer, test, blog, career] = await Promise.all([
      propertyDeletion, developerDeletion, testDeletion, blogDeletion, careerDeletion
    ]);

    // If the ID is not found in any of the collections, handle the error
    if (!property && !developer && !test && !blog && !career) {
      return res.status(404).send('The entry with the given ID was not found in any collection.');
    }

    // Perform deletion only if the entry exists in the respective collection
    const deletionPromises = [];
    if (property) deletionPromises.push(Property.findByIdAndDelete(id));
    if (developer) deletionPromises.push(Developer.findByIdAndDelete(id));
    if (test) deletionPromises.push(Test.findByIdAndDelete(id));
    if (blog) deletionPromises.push(Blog.findByIdAndDelete(id));
    if (career) deletionPromises.push(Career.findByIdAndDelete(id));

    // Wait for all the deletions to finish
    await Promise.all(deletionPromises);

    // Redirect to the admin page after successful deletion
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});


// Logout route
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});



app.post('/add-user', async (req, res) => {
  const { name, email, number } = req.body;

  if (!name || !email || !number) {
    return res.status(400).send('All fields are required');
  }

  try {
    const user = new User({ name, email, number });
    await user.save();
    return res.status(201).send({ message: 'User successfully saved!' });
  } catch (error) {
    console.error('Error saving user:', error);
    return res.status(500).send('Internal Server Error');
  }
});



// Example of handling GET request for the same route
app.get('/add-user', (req, res) => {
  res.send('Please submit the form via POST.');
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.post('/upload', upload.single('file'), (req, res) => {
  console.log(req.file);
  res.send('File uploaded successfully');
});

app.post('/add-developer', isAdmin, upload.single('logo'), async (req, res) => {
  const {
    id,
    name,
    established,
    project,
    shortDescription,
    longDescription,
    ongoingProjects = [],
    cityPresent = []
  } = req.body;

  console.log('File:', req.file);  // Log the file object for debugging

  // Ensure logo is handled correctly
  const logoPath = req.file ? `http://localhost:3000/${req.file.path.replace(/\\/g, '/')}` : '';
  console.log('Logo Path:', logoPath);  // Log the logo path for debugging

  // Create a new Developer with the provided data
  const newDeveloper = new Developer({
    id,
    logo: logoPath, // Use the constructed logoPath
    name,
    established,
    project,
    shortDescription,
    longDescription,
    ongoingProjects,
    cityPresent
  });

  try {
    await newDeveloper.save();
    console.log('New Developer:', newDeveloper);
    res.redirect('/');
  } catch (error) {
    console.error('Error adding developer:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/add-developer', (req, res) => {
  res.render('add-developer'); // Ensure this matches the name of your EJS file
});


app.get("/about", (req, res) => {
  res.render('about')
})

app.get('/contact', (req, res) => {
  res.render("contact")
})

app.get('/developers', async (req, res) => {
  try {
    const developers = await Developer.find().exec();
    const properties = await Property.find().exec(); // Fetch all properties

    res.render('developers', { developers, properties }); // Pass properties as an array
  } catch (error) {
    console.error('Error fetching developers:', error);
    res.status(500).send('Internal Server Error');
  }
});




app.get('/developer/:id', async (req, res) => {
  try {
    const developerId = req.params.id;
    const developer = await Developer.findById(developerId);
    const properties = await Property.find({ developer: req.params.id }).populate('developer');

    if (!developer) {
      return res.status(404).send('Developer not found');
    }
    // Organize properties by plan
    res.render('developers', { developer, properties }); // Pass organized properties to the template
  } catch (error) {
    console.error('Error fetching developer data:', error);
    res.status(500).send('Internal Server Error');
  }
});


app.get('/', async (req, res) => {
  try {
    // Extract and sanitize query parameters
    const selectedCategories = req.query.categories ? req.query.categories.split(',').map(cat => cat.trim()) : [];
    const searchQuery = req.query.search ? sanitizeHtml(req.query.search) : '';

    // Build property filter
    let propertyFilter = {};

    if (selectedCategories.length > 0) {
      propertyFilter.categories = { $in: selectedCategories };
    }

    if (searchQuery) {
      propertyFilter.$or = [
        { name: { $regex: searchQuery, $options: 'i' } },
        { description: { $regex: searchQuery, $options: 'i' } }
      ];
    }

    // Fetch data from database
    const [allProperties, allDevelopers, allTests, locations, developer] = await Promise.all([
      Property.find(propertyFilter),
      Developer.find(),
      Test.find(),
      Property.aggregate([
        { $group: { _id: "$location", count: { $sum: 1 }, locationImage: { $first: "$locationImage" } } },
        { $sort: { _id: 1 } } // Optional: sort locations alphabetically
      ])
    ]);

    // Categorize properties
    const categorizedProperties = {
      trending: allProperties.filter(p => p.categories.includes('Trending')),
      ultra: allProperties.filter(p => p.categories.includes('Ultra luxury')),
      luxury: allProperties.filter(p => p.categories.includes('Luxury Project')),
      premium: allProperties.filter(p => p.categories.includes('Premium Project')),
      affordable: allProperties.filter(p => p.categories.includes('Affordable Project')),
    };

    // Render the view
    res.render('home', {
      properties: categorizedProperties,
      developers: allDevelopers,
      tests: allTests,
      isAdmin: req.session.isAdmin,
      searchQuery: searchQuery,
      selectedCategories: selectedCategories,
      locations: locations,
      developer,
    });
  } catch (err) {
    console.error('Error fetching data:', err);
    res.status(500).send('Server Error');
  }
});





app.get('/property/:id', async (req, res) => {
  console.log('Received request for /property/:id');
  try {
    const propertyId = req.params.id;
    console.log('Property ID:', propertyId);

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(propertyId)) {
      console.error('Invalid property ID:', propertyId);
      return res.status(400).send('Invalid property ID');
    }

    // Fetch the property and populate developer
    const property = await Property.findById(propertyId).populate('developer');

    if (!property) {
      console.error('Property not found for ID:', propertyId);
      return res.status(404).send('Property not found');
    }

    // Prepare categorized properties (if needed for your view)
    const categorizedProperties = {
      trending: property.categories.includes('Trending') ? [property] : [],
      ultra: property.categories.includes('Ultra luxury') ? [property] : [],
      luxury: property.categories.includes('Luxury Project') ? [property] : [],
      premium: property.categories.includes('Premium Project') ? [property] : [],
      affordable: property.categories.includes('Affordable Project') ? [property] : [],
    };

    // Render the EJS template with the property and its developer
    res.render('property', {
      categories: categorizedProperties,
      property,
      developer: property.developer // Use the populated developer directly
    });

  } catch (err) {
    console.error('Error fetching property:', err);
    res.status(500).send('Server Error');
  }
});



app.get('/search', (req, res) => {
  const query = req.query.query.toLowerCase();
  const results = items.filter(item => item.name.toLowerCase().includes(query));
  res.json(results); // Return results as JSON
});

app.get('/list-icons', (req, res) => {
  fs.readdir(path.join(__dirname, 'icons'), (err, files) => {
    if (err) {
      return res.status(500).send('Error reading directory.');
    }
    res.send(files);
  });
});


app.post('/admin/update/developer/:id', isAdmin, upload.single('logo'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      established,
      project,
      shortDescription,
      longDescription,
      ongoingProjects,
      cityPresent,
    } = req.body;

    // Handle logo file
    let logoPath = req.body.logo; // Use existing logo if no new file is uploaded

    if (req.file) {
      logoPath = `http://localhost:3000/${req.file.path.replace(/\\/g, '/')}`; // Adjust path for your setup
    }

    const updatedDeveloper = await Developer.findByIdAndUpdate(id, {
      logo: logoPath,
      name,
      established,
      project,
      shortDescription,
      longDescription,
      ongoingProjects: ongoingProjects ? ongoingProjects.split(',') : [], // Assuming comma-separated input
      cityPresent: cityPresent ? cityPresent.split(',') : [], // Assuming comma-separated input
    }, { new: true });

    if (!updatedDeveloper) {
      return res.status(404).send('Developer not found');
    }

    res.redirect('/');
  } catch (err) {
    console.error('Error updating developer:', err);
    res.status(500).send('Server Error');
  }
});
app.get('/proxy-font', (req, res) => {
  const url = 'https://www.propvestors.in/wp-content/themes/propvestors/scss/icons/font-awesome/fonts/fontawesome-webfont.woff2?v=4.7.0';
  request({ url, encoding: null }, (error, response, body) => {
    if (!error && response.statusCode === 200) {
      res.set('Content-Type', 'font/woff2');
      res.send(body);
    } else {
      res.status(response.statusCode).send('Error fetching font');
    }
  });
});


// Handle updating a property
app.post('/admin/update/property/:id', isAdmin, upload.single('imageUrl'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      categories,
      categories1,
      name,
      location,
      price,
      status,
      configuration,
      possession,
      units,
      land,
      residence,
      builtup,
      blocks,
      floor,
      noofunits,
      rera,
      point1,
      point2,
      point3,
      point4,
      point5,
      point6,
      point7,
      point8,
      point9,
      point10,
      about,
      unitytype,
      size,
      range,
      booking,
      token,
      plans,
      amenities,
      virtual,
      payment,
      logoText1,
      logoText2,
      logoText3,
      logoText4,
      logoText5,
      logoText6,
      logoText7,
      logoText8,
      logoText9,
      logoText10,
      icon,
      by
    } = req.body;

    const updatedProperty = await Property.findByIdAndUpdate(id, {
      categories,
      categories1,
      name,
      location,
      price,
      status,
      configuration,
      possession,
      units,
      land,
      residence,
      builtup,
      blocks,
      floor,
      noofunits,
      rera,
      point1,
      point2,
      point3,
      point4,
      point5,
      point6,
      point7,
      point8,
      point9,
      point10,
      about,
      unitytype,
      size,
      range,
      booking,
      token,
      plans,
      amenities,
      virtual,
      payment,
      logoText1,
      logoText2,
      logoText3,
      logoText4,
      logoText5,
      logoText6,
      logoText7,
      logoText8,
      logoText9,
      logoText10,
      icon,
      by,
      updatedat: new Date(), // Update to the current date
      imageUrl: req.file ? req.file.path : undefined,// Update image URL if a file is uploaded
      Plogo: req.file ? req.file.path : undefined // Update image URL if a file is uploaded
    }, { new: true });

    if (!updatedProperty) {
      return res.status(404).send('Property not found');
    }

    res.redirect('/');
  } catch (err) {
    console.error('Error:', err);
    res.status(500).send('Server Error');
  }
});

app.post('/add', isAdmin, upload.fields([
  { name: 'imageUrl', maxCount: 1 },
  { name: 'Plogo', maxCount: 1 },
  { name: 'floorImg1', maxCount: 1 },
  { name: 'floorImg2', maxCount: 1 },
  { name: 'floorImg3', maxCount: 1 },
  { name: 'floorImg4', maxCount: 1 },
  { name: 'floorImg5', maxCount: 1 },
  { name: 'floorImg6', maxCount: 1 },
  { name: 'floorImg7', maxCount: 1 },
  { name: 'floorImg8', maxCount: 1 },
  { name: 'floorImg9', maxCount: 1 },
  { name: 'floorImg10', maxCount: 1 },
  { name: 'locationImage', maxCount: 1 },
]), async (req, res) => {
  try {
    // Log the submitted developer ID
    console.log('Submitted Developer ID:', req.body.developerId);

    // Find and validate the developer by ID
    const developer = await Developer.findById(req.body.developerId);
    if (!developer) {
      console.log('Developer not found.');
      return res.status(404).send('Unknown Developer');
    }
    const {
      locationAbout,
      by,
      reraCode,
      name,
      location,
      price,
      status,
      configuration,
      possession,
      units,
      land,
      residence,
      builtup,
      blocks,
      floor,
      noofunits,
      rera,
      point1,
      point2,
      point3,
      point4,
      point5,
      point6,
      point7,
      point8,
      point9,
      point10,
      about,
      unitytype,
      size,
      range,
      booking,
      token,
      plans,
      amenities,
      virtual,
      categories,
      payment,
      logoText1,
      logoText2,
      logoText3,
      logoText4,
      logoText5,
      logoText6,
      logoText7,
      logoText8,
      logoText9,
      logoText10,
      icon,
    } = req.body;

    // Retrieve file paths from req.files
    const floorImgs = [];
    for (let i = 1; i <= 10; i++) {
      const field = `floorImg${i}`;
      floorImgs.push(req.files[field] ? req.files[field][0].path : '');
    }

    const logos = [];
    for (let i = 1; i <= 10; i++) {
      const field = `logo${i}`;
      logos.push(req.files[field] ? req.files[field][0].path : '');
    }

    const virtualImgs = [];
    for (let i = 1; i <= 8; i++) {
      const field = `virtualImg${i}`;
      virtualImgs.push(req.files[field] ? req.files[field][0].path : '');
    }

    const virtualVids = [];
    for (let i = 8; i <= 10; i++) {
      const field = `virtualVid${i}`;
      virtualVids.push(req.files[field] ? req.files[field][0].path : '');
    }

    const pdfs = [];
    for (let i = 1; i <= 4; i++) {
      const field = `pdf${i}`;
      pdfs.push(req.files[field] ? req.files[field][0].path : '');
    }

    const parsedCategories = Array.isArray(categories) ? categories : categories ? categories.split(',') : [];

    const newProperty = new Property({
      imageUrl: req.files['imageUrl'] ? `http://localhost:3000/${req.files['imageUrl'][0].path.replace(/\\/g, '/')}` : '',
      Plogo: req.files['Plogo'] ? `http://localhost:3000/${req.files['Plogo'][0].path.replace(/\\/g, '/')}` : '',
      icon: req.files['icon'] ? `http://localhost:3000/${req.files['icon'][0].path.replace(/\\/g, '/')}` : '',
      rera: req.files['rera'] ? `http://localhost:3000/${req.files['rera'][0].path.replace(/\\/g, '/')}` : '',
      locationImage: req.files['locationImage'] ? `http://localhost:3000/${req.files['locationImage'][0].path.replace(/\\/g, '/')}` : '',
      name,
      developer: req.body.developerId, // Use the developerId from the form submission
      location,
      locationAbout,
      reraCode,
      plan: req.body.plan,
      price,
      status,
      configuration,
      possession,
      units,
      land,
      residence,
      builtup,
      blocks,
      floor,
      noofunits,
      rera,
      point1,
      point2,
      point3,
      point4,
      point5,
      point6,
      point7,
      point8,
      point9,
      point10,
      about,
      unitytype,
      size,
      range,
      booking,
      token,
      plans,
      floorImg1: req.files['floorImg1'] ? `http://localhost:3000/${req.files['floorImg1'][0].path.replace(/\\/g, '/')}` : '',
      floorImg2: req.files['floorImg2'] ? `http://localhost:3000/${req.files['floorImg2'][0].path.replace(/\\/g, '/')}` : '',
      floorImg3: req.files['floorImg3'] ? `http://localhost:3000/${req.files['floorImg3'][0].path.replace(/\\/g, '/')}` : '',
      floorImg4: req.files['floorImg4'] ? `http://localhost:3000/${req.files['floorImg4'][0].path.replace(/\\/g, '/')}` : '',
      floorImg5: req.files['floorImg5'] ? `http://localhost:3000/${req.files['floorImg5'][0].path.replace(/\\/g, '/')}` : '',
      floorImg6: req.files['floorImg6'] ? `http://localhost:3000/${req.files['floorImg6'][0].path.replace(/\\/g, '/')}` : '',
      floorImg7: req.files['floorImg7'] ? `http://localhost:3000/${req.files['floorImg7'][0].path.replace(/\\/g, '/')}` : '',
      floorImg8: req.files['floorImg8'] ? `http://localhost:3000/${req.files['floorImg8'][0].path.replace(/\\/g, '/')}` : '',
      floorImg9: req.files['floorImg9'] ? `http://localhost:3000/${req.files['floorImg9'][0].path.replace(/\\/g, '/')}` : '',
      floorImg10: req.files['floorImg10'] ? `http://localhost:3000/${req.files['floorImg10'][0].path.replace(/\\/g, '/')}` : '',
      amenities,
      virtual,
      categories: parsedCategories,
      payment,
      pdfs, // Array of PDF paths
      logoText1,
      logoText2,
      logoText3,
      logoText4,
      logoText5,
      logoText6,
      logoText7,
      logoText8,
      logoText9,
      logoText10,
      icon,
      logos, // Array of logo paths
      virtualVids, // Array of video paths
      by

    });

    await newProperty.save();
    console.log(newProperty)
    console.log('Files:', req.files);
    res.redirect('/');
  } catch (err) {
    console.error(err); // Log error details for debugging
    res.status(500).send('Server Error');
  }
});

app.get('/properties/location/:location', async (req, res) => {
  try {
    const location = decodeURIComponent(req.params.location); // Decode URL-encoded location
    console.log('Location:', location);

    // Query the database for properties in the specified location
    const properties = await Property.find({ location: location });

    // Render the view or send response
    res.render('location', { properties, location });
  } catch (err) {
    console.error('Error fetching properties:', err);
    res.status(500).send('Server Error');
  }
});

// Route to render the career submission form
app.get('/career-form', (req, res) => {
  res.render('career-form');  // Render the career-form.ejs template
});

// Route to handle form submission (POST request)
app.post('/career', async (req, res) => {
  try {
    const { role, experience, location } = req.body;

    // Create a new career entry
    const newCareer = new Career({
      role,
      experience,
      location,
    });

    // Use async/await to save the new career document
    await newCareer.save();  // .save() now returns a Promise

    // After saving, redirect to the career listing page
    res.redirect('/career');
  } catch (err) {
    console.error(err);
    return res.status(500).send("Error saving career data");
  }
});

// Route to show career opportunities
app.get('/career', async (req, res) => {
  try {
    const careers = await Career.find();  // .find() returns a Promise now
    res.render('career', { careers: careers });
  } catch (err) {
    console.error(err);
    return res.status(500).send("Error fetching career data");
  }
});
// Route to handle DELETE request for career deletion
app.delete('/career/:id', async (req, res) => {
  try {
    // Get the career ID from the URL
    const careerId = req.params.id;

    // Find the career and delete it from the database
    await Career.findByIdAndDelete(careerId);

    // After deleting, redirect to the career page to see updated list
    res.redirect('/career');
  } catch (err) {
    console.error(err);
    return res.status(500).send("Error deleting career data");
  }
});

// Show trending blogs
app.get('/trending', async (req, res) => {
  const blogs = await Blog.find().sort({ createdAt: -1 });
  res.render('trending', { blogs });
});

// Show new blog form
app.get('/new', (req, res) => {
  res.render('new');
});

// Handle new blog creation
app.post('/new', upload.fields([{ name: 'image' }, { name: 'imgOne' }]), async (req, res) => {
  console.log(req.body); // Log the request body

  // Destructure the required fields from the request body
  const { heading, headingOne, aboutOne, about, loction, dates } = req.body;

  // Handle uploaded images, ensuring to replace backslashes in paths
  const image = req.files['image'] ? `http://localhost:3000/${req.files['image'][0].path.replace(/\\/g, '/')}` : ''
  const imgOne = req.files['imgOne'] ? `http://localhost:3000/${req.files['imgOne'][0].path.replace(/\\/g, '/')}` : ''

  // Log the specific values for debugging
  console.log(`Heading: ${heading}, About: ${about}, Location: ${location}, Dates: ${dates}`);

  try {
    // Create a new blog instance
    const blog = new Blog({ heading, headingOne, aboutOne, about, image, imgOne, location, dates });

    // Save the blog to the database
    await blog.save();

    // Redirect to the trending page
    res.redirect('trending');
  } catch (error) {
    // Log the error and send a 500 response
    console.error('Error saving blog:', error);
    res.status(500).send('Internal Server Error');
  }
});
// Render edit form
app.get('/admin/edit/:id', async (req, res) => {
  const blog = await Blog.findById(req.params.id);
  if (!blog) {
    return res.status(404).send('Blog not found');
  }
  res.render('edit', { blog }); // Create an edit.ejs file for the edit form
});

// Handle blog update
app.post('/admin/edit/:id', upload.fields([{ name: 'image' }, { name: 'imgOne' }]), async (req, res) => {
  const { heading, about, HeadingOne, aboutOne, loction, dates } = req.body;

  const updatedData = { heading, about, HeadingOne, aboutOne, loction, dates };

  // Handle file upload
  if (req.files) {
    if (req.files.image && req.files.image.length > 0) {
      updatedData.image = req.files['image'] ? `http://localhost:3000/${req.files['image'][0].path.replace(/\\/g, '/')}` : '' // Ensure proper path format
    }
    if (req.files.imgOne && req.files.imgOne.length > 0) {
      updatedData.imgOne = req.files['imgOne'] ? `http://localhost:3000/${req.files['imgOne'][0].path.replace(/\\/g, '/')}` : '' // Ensure proper path format
    }
  }

  try {
    const result = await Blog.findByIdAndUpdate(req.params.id, updatedData, { new: true });
    if (!result) {
      return res.status(404).send('Blog not found'); // Handle not found
    }
    res.redirect('/admin'); // Redirect back to admin page
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).send('Error updating blog post');
  }
});

app.get('/term', (req, res) => {
  res.render('term')
})
app.get('/policy', (req, res) => {
  res.render('policy')
})

app.get('/blogdetails/:id', async (req, res) => {
  try {
    const blogId = req.params.id;
    const blog = await Blog.findById(blogId); // Make sure your Blog model is set up correctly
    if (!blog) {
      return res.status(404).send('Blog not found');
    }
    res.render('blogdetails', { blog }); // Render the blogdetails.ejs template with the blog data
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
