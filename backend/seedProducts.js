const mysql = require("mysql2/promise");
require("dotenv").config();

const products = [
    { name: 'Classic Cotton T-Shirt', description: 'Summer collection soft cotton tee.', price: 19.99, image: '/assets/images/f1.jpg', category: 'T-Shirts', stock: 50, featured: 1},
    { name: 'Graphic Summer Tee', description: 'Vibrant graphic tee for summer.', price: 24.99, image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRyY_WkHP0-WBtjcePjG1sLSoMouKgAaav1hg&s', category: 'T-Shirts', stock: 30, featured: 0},
    { name: 'Striped Casual Tee', description: 'Comfortable striped tee.', price: 21.99, image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQtKfu-ZwefkG7NDs5d3PhgFBSgTHhEN01ENQ&s', category: 'T-Shirts', stock: 22, featured: 0},
    { name: 'V-Neck Tee', description: 'Soft v-neck t-shirt.', price: 17.99, image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTsSS_5k6nLRteqeDYfhRBiA65nBAAXQA2Nwg&s', category: 'T-Shirts', stock: 18, featured: 0},
    { name: 'Pocket Tee', description: 'Casual pocket tee.', price: 18.99, image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRuw0Ab_4tzp6NAd8VHYZzV9OYF59aklaeEeA&s', category: 'T-Shirts', stock: 12, featured: 0},

    { name: 'Cozy Hoodie', description: 'Lightweight hoodie for cool evenings.', price: 39.99, image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSPkTgVrxAbFAb4VMnRmqKfLq1mlPwKCf3PQg&s', category: 'Hoodies', stock: 40, featured: 1},
    { name: 'Zip-Up Hoodie', description: 'Casual zip hoodie.', price: 44.99, image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQEk5MDT4E_9vjAF7bci9TCMuPYw_yUrdJ1Gw&s', category: 'Hoodies', stock: 40, featured: 0},
    { name: 'Pullover Hoodie', description: 'Cozy pullover style.', price: 42.99, image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTua6NALhSutNTSeAx3JEGPipEhDhEoUAoISw&s', category: 'Hoodies', stock: 28, featured: 0},
    { name: 'Fleece Hoodie', description: 'Warm fleece hoodie.', price: 49.99, image: '/assets/images/f2.jpg', category: 'Hoodies', stock: 14, featured: 0},
    { name: 'Sport Hoodie', description: 'Performance hoodie for workouts.', price: 46.99, image: '/assets/images/f3.jpg', category: 'Hoodies', stock: 32, featured: 0},

    { name: 'Windbreaker Jacket', description: 'Water-resistant windbreaker.', price: 59.99, image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRUk5pMwkIaq5m32eSfcLfuTTYXPd_gZxmDrg&s', category: 'Jackets', stock: 20, featured: 0},
    { name: 'Denim Jacket', description: 'Classic denim jacket.', price: 69.99, image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS742gOUs3PYj6pGiEL7vxtCYtcdntbkSzg1Q&s', category: 'Jackets', stock: 15, featured: 1},
    { name: 'Leather Jacket', description: 'Stylish faux-leather jacket.', price: 119.99, image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS3Zm904oGz9FyfDetC1LY41uK35Udmgl01bQ&s', category: 'Jackets', stock: 8, featured: 0},
    { name: 'Bomber Jacket', description: 'Classic bomber jacket.', price: 89.99, image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTT_Z8bOxgvwY4ahNxGg4TkryUn2gowHQL51w&s', category: 'Jackets', stock: 11, featured: 0},
    { name: 'Denim Trucker', description: 'Lightweight trucker jacket.', price: 74.99, image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQOazqR3Pt7KgK3iTwtReHvCLpQaIKhphOTjA&s', category: 'Jackets', stock: 6, featured: 0}
];

async function seed() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: 3306
    });

    console.log("Connected to DB, inserting products...");
    for (const p of products) {
        await connection.execute(
            `INSERT INTO products (name, description, price, image, category, stock, featured) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [p.name, p.description, p.price, p.image, p.category, p.stock, p.featured]
        );
    }
    console.log("Successfully seeded database with placeholder products!");
    await connection.end();
}

seed().catch(console.error);
