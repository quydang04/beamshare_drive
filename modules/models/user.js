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
	emailVerified: {
		type: Boolean,
		default: false
	},
	emailVerificationToken: {
		type: String,
		index: true,
		sparse: true
	},
	emailVerificationExpires: {
		type: Date
	},
	plan: {
		type: String,
		enum: ['basic', 'premium'],
		default: 'basic',
		index: true
	},
	fullName: {
		type: String,
		trim: true
	},
	passwordResetToken: {
		type: String,
		index: true,
		sparse: true
	},
	passwordResetExpires: {
		type: Date
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
		emailVerified: Boolean(this.emailVerified),
		plan: this.plan || 'basic',
		fullName: this.fullName,
		createdAt: this.createdAt,
		updatedAt: this.updatedAt
	};
};

module.exports = mongoose.model('User', userSchema);
