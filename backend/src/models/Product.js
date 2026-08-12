const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    stock: {
      type: Number,
      default: 0,
      min: [0, 'Stock cannot be negative'],
    },
    category: {
      type: String,
      default: 'general',
    },
  },
  { timestamps: true }
);

productSchema.method('save', function(...args) {
  const err = this.validateSync();
  if (err) {
    err.status = 400;
    err.statusCode = 400;
    throw err;
  }
  return mongoose.Model.prototype.save.apply(this, args);
}, { suppressWarning: true });

mongoose.Error.ValidationError.prototype.status = 400;
mongoose.Error.ValidationError.prototype.statusCode = 400;

module.exports = mongoose.model('Product', productSchema);
