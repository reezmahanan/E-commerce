class Review {
  constructor(review) {
    const rating = review.rating ?? 0;
    if (rating < 1 || rating > 5) {
      throw new Error("Rating must be between 1 and 5");
    }

    const comment = review.comment ?? "";
    if (comment.length > 1000) {
      throw new Error("Comment cannot exceed 1000 characters");
    }

    this.id = review.id;
    this.productId = review.productId || review.product_id;
    this.userId = review.userId || review.user_id;
    this.userName = review.userName || review.user_name || review.name || "";
    this.rating = rating;
    this.comment = comment;

    this.createdAt = new Date(review.createdAt || review.created_at || new Date());

    this.updatedAt = new Date(review.updatedAt || review.updated_at || new Date());

    this.isDeleted =
      review.isDeleted !== undefined
        ? review.isDeleted
        : review.is_deleted || false;

    this.deletedAt = review.deletedAt || review.deleted_at || null;
  }

  toJSON() {
    return {
      id: this.id,
      product_id: this.productId,
      user_id: this.userId,
      user_name: this.userName,
      rating: this.rating,
      comment: this.comment,
      created_at: this.createdAt,
      updated_at: this.updatedAt,
      is_deleted: this.isDeleted,
      deleted_at: this.deletedAt,
    };
  }

  isRecent() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return new Date(this.createdAt) >= sevenDaysAgo;
  }

  update(updates) {
    if (updates.rating !== undefined) {
      if (updates.rating < 1 || updates.rating > 5) {
        throw new Error("Rating must be between 1 and 5");
      }
      this.rating = updates.rating;
    }

    if (updates.comment !== undefined) {
      if (updates.comment.length > 1000) {
        throw new Error("Comment cannot exceed 1000 characters");
      }
      this.comment = updates.comment;
    }

    if (updates.userName !== undefined) {
      this.userName = updates.userName;
    } else if (updates.user_name !== undefined) {
      this.userName = updates.user_name;
    }

    this.updatedAt = new Date();
    return this;
  }

  delete() {
    this.isDeleted = true;
    this.deletedAt = new Date();
    this.updatedAt = new Date();
    return this;
  }

  restore() {
    this.isDeleted = false;
    this.deletedAt = null;
    this.updatedAt = new Date();
    return this;
  }

  static validate(review) {
    const errors = [];

    if (
      review.rating === undefined ||
      review.rating === null ||
      review.rating < 1 ||
      review.rating > 5
    ) {
      errors.push("Rating must be between 1 and 5");
    }

    if (review.comment && review.comment.length > 1000) {
      errors.push("Comment cannot exceed 1000 characters");
    }

    if (!review.productId && !review.product_id) {
      errors.push("Product ID is required");
    }

    if (!review.userId && !review.user_id) {
      errors.push("User ID is required");
    }

    return {
      isValid: errors.length === 0,
      errors: errors,
    };
  }
}

module.exports = Review;