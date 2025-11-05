const mongoose = require('mongoose');

let connectionPromise = null;

async function connectDatabase() {
    if (connectionPromise) {
        return connectionPromise;
    }

    const { MONGODB_URI, MONGODB_DB_NAME } = process.env;

    if (!MONGODB_URI) {
        throw new Error('MONGODB_URI is not configured. Please set it in your environment.');
    }

    if (!MONGODB_DB_NAME) {
        throw new Error('MONGODB_DB_NAME is not configured. Please set it in your environment.');
    }

    mongoose.set('strictQuery', true);

    connectionPromise = mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
    dbName: MONGODB_DB_NAME
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
