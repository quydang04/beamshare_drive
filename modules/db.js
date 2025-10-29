const mongoose = require('mongoose');

let connectionPromise = null;

async function connectDatabase() {
    if (connectionPromise) {
        return connectionPromise;
    }

    const uri = process.env.MONGODB_URI;
    if (!uri) {
        throw new Error('Missing MONGODB_URI environment variable');
    }

    mongoose.set('strictQuery', true);

    connectionPromise = mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000
    }).then((conn) => {
        console.log('Connected to MongoDB');
        return conn;
    }).catch((error) => {
        connectionPromise = null;
        console.error('MongoDB connection failed:', error.message);
        throw error;
    });

    return connectionPromise;
}

module.exports = {
    connectDatabase
};
