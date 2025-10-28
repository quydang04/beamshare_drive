const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const userSchema = new mongoose.Schema({
	userId: {
		type: String,
		unique: true,
		index: true
	},
	email: {
		type: String,
		required: true,
		unique: true,
		lowercase: true,
		trim: true
	},
	passwordHash: {
		type: String,
		required: true
	},
	fullName: {
		type: String,
		trim: true
	}
}, {
	timestamps: true
});

userSchema.pre('validate', function assignUserId(next) {
	if (!this.userId) {
		this.userId = uuidv4();
	}
	next();
});

userSchema.methods.toPublicProfile = function toPublicProfile() {
	return {
		id: this._id.toString(),
		userId: this.userId,
		email: this.email,
		fullName: this.fullName,
		createdAt: this.createdAt,
		updatedAt: this.updatedAt
	};
};

module.exports = mongoose.model('User', userSchema);
