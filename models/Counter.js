'use strict';

const mongoose = require('mongoose');

/**
 * Counter Schema
 * Provides an atomic daily sequence for generating unique order codes.
 *
 * Example document:
 *   { date: "20260419", seq: 3 }
 *
 * Used by orderService.generateOrderCode() with findOneAndUpdate + $inc
 * to guarantee atomic, race-condition-safe incrementing.
 */
const counterSchema = new mongoose.Schema({
  date: {
    type: String,
    required: true,
    index: true,
  },
  seq: {
    type: Number,
    default: 0,
  },
});

const Counter = mongoose.model('Counter', counterSchema);

module.exports = Counter;
