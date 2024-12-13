
// models/Career.js

const mongoose = require('mongoose');

const testSchema = new mongoose.Schema({
  role: String,
  experience:String,
  location:String,
});

module.exports = mongoose.model('Career', testSchema);

