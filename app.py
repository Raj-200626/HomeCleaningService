import os
import secrets
from datetime import datetime, timedelta
from dotenv import load_dotenv
from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
db_url = os.getenv('DATABASE_URL')
if not db_url:
    db_type = os.getenv('DB_TYPE', 'sqlite').lower()
    if db_type == 'sqlite':
        db_url = 'sqlite:///home_cleaning.db'
    else:
        db_url = f"postgresql://{os.getenv('DB_USER', 'postgres')}:{os.getenv('DB_PASSWORD', 'password')}@{os.getenv('DB_HOST', 'localhost')}:{os.getenv('DB_PORT', '5432')}/{os.getenv('DB_NAME', 'home_cleaning_db')}"
app.config['SQLALCHEMY_DATABASE_URI'] = db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'
login_manager.login_message_category = 'info'


class User(UserMixin, db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(150), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False)
    phone = db.Column(db.String(20), nullable=False)
    address = db.Column(db.Text)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(20), default='customer')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    bookings = db.relationship('Booking', backref='customer', lazy=True, cascade='all, delete-orphan')
    contacts = db.relationship('Contact', backref='user', lazy=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password, method='pbkdf2:sha256')

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)


class Service(db.Model):
    __tablename__ = 'services'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=False)
    price = db.Column(db.Numeric(10, 2), nullable=False)
    duration = db.Column(db.String(50))
    image = db.Column(db.String(255))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    bookings = db.relationship('Booking', backref='service', lazy=True)


class Booking(db.Model):
    __tablename__ = 'bookings'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    service_id = db.Column(db.Integer, db.ForeignKey('services.id'), nullable=False)
    booking_date = db.Column(db.Date, nullable=False)
    booking_time = db.Column(db.Time, nullable=False)
    address = db.Column(db.Text, nullable=False)
    city = db.Column(db.String(100), nullable=False)
    postal_code = db.Column(db.String(20))
    notes = db.Column(db.Text)
    status = db.Column(db.String(20), default='pending')
    total_price = db.Column(db.Numeric(10, 2), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Contact(db.Model):
    __tablename__ = 'contacts'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    name = db.Column(db.String(150), nullable=False)
    email = db.Column(db.String(150), nullable=False)
    subject = db.Column(db.String(200))
    message = db.Column(db.Text, nullable=False)
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class Testimonial(db.Model):
    __tablename__ = 'testimonials'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    role = db.Column(db.String(100))
    message = db.Column(db.Text, nullable=False)
    rating = db.Column(db.Integer, default=5)
    image = db.Column(db.String(255))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class PasswordResetToken(db.Model):
    __tablename__ = 'password_reset_tokens'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    token = db.Column(db.String(256), unique=True, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_used = db.Column(db.Boolean, default=False)
    user = db.relationship('User', backref=db.backref('reset_tokens', lazy=True))

    def is_valid(self):
        return not self.is_used and datetime.utcnow() < self.expires_at


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


def seed_services():
    default_services = [
        {
            'name': 'Regular House Cleaning',
            'description': 'Standard cleaning service covering all rooms, dusting, vacuuming, mopping, kitchen and bathroom cleaning.',
            'price': 7499,
            'duration': '2-3 hours',
            'image': 'regular-cleaning.jpg'
        },
        {
            'name': 'Deep Cleaning',
            'description': 'Thorough deep cleaning service including hard-to-reach areas, behind appliances, inside cabinets, and detailed sanitization.',
            'price': 16499,
            'duration': '4-6 hours',
            'image': 'deep-cleaning.jpg'
        },
        {
            'name': 'Move In/Out Cleaning',
            'description': 'Complete cleaning for moving in or out ensuring your old or new home is spotless and ready for occupancy.',
            'price': 20999,
            'duration': '5-7 hours',
            'image': 'move-cleaning.jpg'
        },
        {
            'name': 'Kitchen & Bathroom',
            'description': 'Specialized cleaning for kitchens and bathrooms with focus on grease removal, tile scrubbing, and sanitization.',
            'price': 10999,
            'duration': '2-3 hours',
            'image': 'kitchen-bath.jpg'
        },
        {
            'name': 'Window Cleaning',
            'description': 'Professional interior and exterior window cleaning for streak-free, sparkling results.',
            'price': 6499,
            'duration': '1-2 hours',
            'image': 'window-cleaning.jpg'
        },
        {
            'name': 'Carpet Cleaning',
            'description': 'Deep carpet cleaning using professional equipment to remove stains, dirt, and allergens effectively.',
            'price': 8499,
            'duration': '2-3 hours',
            'image': 'carpet-cleaning.jpg'
        }
    ]
    testimonials = [
        Testimonial(
            name='Sarah Johnson',
            role='Regular Customer',
            message='Absolutely amazing service! My house has never looked so clean. The team was professional and thorough.',
            rating=5
        ),
        Testimonial(
            name='Michael Chen',
            role='Homeowner',
            message='Best cleaning service in town. Reliable, affordable, and the attention to detail is outstanding.',
            rating=5
        ),
        Testimonial(
            name='Emma Wilson',
            role='Busy Professional',
            message='As a working mom, this service is a lifesaver. They always show up on time and do an incredible job.',
            rating=5
        )
    ]
    for svc_data in default_services:
        existing = Service.query.filter_by(name=svc_data['name']).first()
        if existing:
            existing.description = svc_data['description']
            existing.price = svc_data['price']
            existing.duration = svc_data['duration']
            existing.image = svc_data['image']
        else:
            db.session.add(Service(**svc_data))
    existing_count = Testimonial.query.count()
    if existing_count == 0:
        db.session.add_all(testimonials)
    db.session.commit()


def seed_admin():
    admin = User.query.filter_by(email='admin@clean.com').first()
    if admin:
        return
    admin = User(
        full_name='Administrator',
        email='admin@clean.com',
        phone='555-0100',
        address='123 Main Street',
        role='admin'
    )
    admin.set_password('admin123')
    db.session.add(admin)
    db.session.commit()


@app.route('/')
def home():
    services = Service.query.filter_by(is_active=True).limit(6).all()
    testimonials = Testimonial.query.filter_by(is_active=True).all()
    return render_template('index.html', services=services, testimonials=testimonials)


@app.route('/services')
def services():
    all_services = Service.query.filter_by(is_active=True).all()
    return render_template('services.html', services=all_services)


@app.route('/about')
def about():
    return render_template('about.html')


@app.route('/contact', methods=['GET', 'POST'])
def contact():
    if request.method == 'POST':
        data = request.form
        user_id = current_user.id if current_user.is_authenticated else None
        contact_msg = Contact(
            user_id=user_id,
            name=data.get('name', '').strip(),
            email=data.get('email', '').strip(),
            subject=data.get('subject', '').strip(),
            message=data.get('message', '').strip()
        )
        if not contact_msg.name or not contact_msg.email or not contact_msg.message:
            flash('Please fill in all required fields.', 'error')
            return redirect(url_for('contact'))
        db.session.add(contact_msg)
        db.session.commit()
        flash('Thank you for your message! We will get back to you soon.', 'success')
        return redirect(url_for('contact'))
    return render_template('contact.html')


@app.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('home'))
    if request.method == 'POST':
        data = request.form
        full_name = data.get('full_name', '').strip()
        email = data.get('email', '').strip().lower()
        phone = data.get('phone', '').strip()
        address = data.get('address', '').strip()
        password = data.get('password', '')
        confirm_password = data.get('confirm_password', '')

        errors = []
        if len(full_name) < 2:
            errors.append('Full name must be at least 2 characters.')
        if User.query.filter_by(email=email).first():
            errors.append('Email is already registered.')
        if len(password) < 6:
            errors.append('Password must be at least 6 characters.')
        if password != confirm_password:
            errors.append('Passwords do not match.')
        if not phone:
            errors.append('Phone number is required.')

        if errors:
            for e in errors:
                flash(e, 'error')
            return redirect(url_for('register'))

        user = User(full_name=full_name, email=email, phone=phone, address=address)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        flash('Registration successful! Please login.', 'success')
        return redirect(url_for('login'))
    return render_template('register.html')


@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('home'))
    if request.method == 'POST':
        data = request.form
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        user = User.query.filter_by(email=email).first()
        if user and user.check_password(password):
            login_user(user, remember=data.get('remember'))
            next_page = request.args.get('next')
            flash(f'Welcome back, {user.full_name}!', 'success')
            return redirect(next_page or url_for('home'))
        flash('Invalid email or password.', 'error')
        return redirect(url_for('login'))
    return render_template('login.html')


@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('You have been logged out successfully.', 'info')
    return redirect(url_for('home'))


@app.route('/forgot-password', methods=['GET', 'POST'])
def forgot_password():
    if current_user.is_authenticated:
        return redirect(url_for('home'))
    reset_link = None
    if request.method == 'POST':
        email = request.form.get('email', '').strip().lower()
        user = User.query.filter_by(email=email).first()
        if user:
            token_str = secrets.token_urlsafe(32)
            reset_token = PasswordResetToken(
                user_id=user.id,
                token=token_str,
                expires_at=datetime.utcnow() + timedelta(hours=1)
            )
            db.session.add(reset_token)
            db.session.commit()
            reset_link = url_for('reset_password', token=token_str, _external=True)
            flash('Password reset link generated! Click the link below to reset your password.', 'success')
        else:
            flash('No account found with that email address.', 'error')
    return render_template('forgot_password.html', reset_link=reset_link)


@app.route('/reset-password/<token>', methods=['GET', 'POST'])
def reset_password(token):
    if current_user.is_authenticated:
        return redirect(url_for('home'))
    reset_token = PasswordResetToken.query.filter_by(token=token).first()
    if not reset_token or not reset_token.is_valid():
        flash('Invalid or expired password reset link. Please request a new one.', 'error')
        return redirect(url_for('forgot_password'))
    if request.method == 'POST':
        password = request.form.get('password', '')
        confirm_password = request.form.get('confirm_password', '')
        if len(password) < 6:
            flash('Password must be at least 6 characters.', 'error')
        elif password != confirm_password:
            flash('Passwords do not match.', 'error')
        else:
            user = reset_token.user
            user.set_password(password)
            reset_token.is_used = True
            db.session.commit()
            flash('Password reset successful! You can now login with your new password.', 'success')
            return redirect(url_for('login'))
    return render_template('reset_password.html', token=token)


@app.route('/booking/<int:service_id>', methods=['GET', 'POST'])
@login_required
def booking(service_id):
    service = Service.query.get_or_404(service_id)
    if request.method == 'POST':
        data = request.form
        date_str = data.get('booking_date', '')
        time_str = data.get('booking_time', '')
        address = data.get('address', '').strip()
        city = data.get('city', '').strip()
        postal_code = data.get('postal_code', '').strip()
        notes = data.get('notes', '').strip()

        errors = []
        if not date_str or not time_str:
            errors.append('Please select date and time.')
        else:
            try:
                b_date = datetime.strptime(date_str, '%Y-%m-%d').date()
                b_time = datetime.strptime(time_str, '%H:%M').time()
                if b_date < datetime.utcnow().date():
                    errors.append('Cannot book a past date.')
            except ValueError:
                errors.append('Invalid date or time format.')
        if not address:
            errors.append('Address is required.')
        if not city:
            errors.append('City is required.')

        if errors:
            for e in errors:
                flash(e, 'error')
            return redirect(url_for('booking', service_id=service_id))

        booking_record = Booking(
            user_id=current_user.id,
            service_id=service.id,
            booking_date=b_date,
            booking_time=b_time,
            address=address,
            city=city,
            postal_code=postal_code,
            notes=notes,
            total_price=service.price
        )
        db.session.add(booking_record)
        db.session.commit()
        flash(f'Booking successful! Your #{booking_record.id} has been placed.', 'success')
        return redirect(url_for('my_bookings'))

    return render_template('booking.html', service=service)


@app.route('/my-bookings')
@login_required
def my_bookings():
    bookings = Booking.query.filter_by(user_id=current_user.id).order_by(Booking.created_at.desc()).all()
    return render_template('my_bookings.html', bookings=bookings)


@app.route('/dashboard')
@login_required
def dashboard():
    if current_user.role != 'admin':
        flash('Access denied. Admin privileges required.', 'error')
        return redirect(url_for('home'))
    total_bookings = Booking.query.count()
    pending_bookings = Booking.query.filter_by(status='pending').count()
    completed_bookings = Booking.query.filter_by(status='completed').count()
    confirmed_bookings = Booking.query.filter_by(status='confirmed').count()
    total_users = User.query.filter_by(role='customer').count()
    total_services = Service.query.filter_by(is_active=True).count()
    total_revenue = db.session.query(db.func.sum(Booking.total_price)).scalar() or 0
    recent_bookings = Booking.query.order_by(Booking.created_at.desc()).limit(5).all()
    unread_contacts = Contact.query.filter_by(is_read=False).count()
    return render_template('dashboard.html',
                           total_bookings=total_bookings,
                           pending_bookings=pending_bookings,
                           completed_bookings=completed_bookings,
                           confirmed_bookings=confirmed_bookings,
                           total_users=total_users,
                           total_services=total_services,
                           total_revenue=total_revenue,
                           recent_bookings=recent_bookings,
                           unread_contacts=unread_contacts)


@app.route('/admin/bookings')
@login_required
def admin_bookings():
    if current_user.role != 'admin':
        return redirect(url_for('home'))
    status_filter = request.args.get('status', 'all')
    query = Booking.query
    if status_filter != 'all':
        query = query.filter_by(status=status_filter)
    bookings = query.order_by(Booking.created_at.desc()).all()
    return render_template('admin_bookings.html', bookings=bookings, status_filter=status_filter)


@app.route('/admin/bookings/<int:booking_id>/status/<status>', methods=['POST'])
@login_required
def update_booking_status(booking_id, status):
    if current_user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    booking = Booking.query.get_or_404(booking_id)
    if status in ['pending', 'confirmed', 'completed', 'cancelled']:
        booking.status = status
        db.session.commit()
        flash(f'Booking #{booking_id} status updated to {status}.', 'success')
    return redirect(url_for('admin_bookings'))


@app.route('/admin/contacts')
@login_required
def admin_contacts():
    if current_user.role != 'admin':
        return redirect(url_for('home'))
    contacts = Contact.query.order_by(Contact.created_at.desc()).all()
    return render_template('admin_contacts.html', contacts=contacts)


@app.route('/admin/contacts/<int:contact_id>/toggle-read', methods=['POST'])
@login_required
def toggle_contact_read(contact_id):
    if current_user.role != 'admin':
        return redirect(url_for('home'))
    contact = Contact.query.get_or_404(contact_id)
    contact.is_read = not contact.is_read
    db.session.commit()
    return redirect(url_for('admin_contacts'))


@app.route('/admin/users')
@login_required
def admin_users():
    if current_user.role != 'admin':
        return redirect(url_for('home'))
    users = User.query.filter_by(role='customer').order_by(User.created_at.desc()).all()
    users_with_bookings = sum(1 for u in users if u.bookings)
    return render_template('admin_users.html', users=users, users_with_bookings=users_with_bookings)


@app.route('/admin/services', methods=['GET', 'POST'])
@login_required
def admin_services():
    if current_user.role != 'admin':
        return redirect(url_for('home'))
    if request.method == 'POST':
        data = request.form
        action = data.get('action', '')
        if action == 'create':
            service = Service(
                name=data.get('name', '').strip(),
                description=data.get('description', '').strip(),
                price=float(data.get('price', 0)),
                duration=data.get('duration', '').strip(),
                image=data.get('image', '').strip()
            )
            db.session.add(service)
            db.session.commit()
            flash('Service created successfully.', 'success')
        elif action == 'toggle':
            service = Service.query.get(int(data.get('service_id')))
            service.is_active = not service.is_active
            db.session.commit()
            flash(f'Service {"" if service.is_active else "de"}activated.', 'info')
    services = Service.query.order_by(Service.created_at.desc()).all()
    return render_template('admin_services.html', services=services)


@app.route('/api/services')
def api_services():
    services = Service.query.filter_by(is_active=True).all()
    return jsonify([{
        'id': s.id,
        'name': s.name,
        'description': s.description,
        'price': float(s.price),
        'duration': s.duration,
        'image': s.image
    } for s in services])


def init_db():
    with app.app_context():
        db.create_all()
        seed_services()
        seed_admin()
        print('Database initialized successfully.')


if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000)
