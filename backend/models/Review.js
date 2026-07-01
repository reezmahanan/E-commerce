class Review {
    constructor(review) {
        this.id = review.id;
        this.productId = review.product_id;
        this.userId = review.user_id;
        this.userName = review.user_name || review.name || "";
        this.rating = review.rating || 0;
        this.comment = review.comment || "";
        this.createdAt = review.created_at || new Date();
    }
}

module.exports = Review;
