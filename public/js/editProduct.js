'use strict';

/**
 * public/js/editProduct.js
 *
 * Handles image-removal tracking for the Edit Product form.
 * Size/quantity fields are managed by inventory.js (shared with Add Product).
 *
 * On form submit: reads all checked .image-remove-checkbox elements and
 * writes their filenames (comma-separated) into the hidden imagesToRemove field,
 * so the server knows which images to delete from the filesystem.
 */
document.addEventListener('DOMContentLoaded', function () {
  var editProductForm      = document.getElementById('editProductForm');
  var imagesToRemoveHidden = document.getElementById('imagesToRemoveHidden');

  if (!editProductForm || !imagesToRemoveHidden) return;

  // Collect checked image-deletion checkboxes and populate the hidden field
  editProductForm.addEventListener('submit', function () {
    var checked   = document.querySelectorAll('.image-remove-checkbox:checked');
    var filenames = Array.from(checked).map(function (cb) {
      return cb.dataset.filename;
    });
    imagesToRemoveHidden.value = filenames.join(',');
  });

  // Client-side: warn if new images total exceeds 5 MB
  editProductForm.addEventListener('submit', function (e) {
    var imagesInput = document.getElementById('images');
    if (!imagesInput) return;
    var files     = imagesInput.files;
    var totalSize = 0;
    for (var i = 0; i < files.length; i++) {
      totalSize += files[i].size;
    }
    if (totalSize > 5 * 1024 * 1024) {
      e.preventDefault();
      alert('مجموع كل الصور يجب ألا يتجاوز 5 ميجابايت');
    }
  });
});
