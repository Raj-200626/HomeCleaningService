/**
 * Booking Page JavaScript for Home Cleaning Service
 * Handles booking-specific interactions and validation
 *
 * Features:
 * - Date/time validation (disable past dates/times, warn if within 2 hours)
 * - Address field character counter with limit
 * - Confirm booking dialog before submit
 * - Comprehensive form field validation with inline error messages
 */

(function () {
    'use strict';

    // Configurable defaults
    var CONFIG = {
        // Minimum notice required (in hours) before a booking
        minNoticeHours: 2,
        // Address character limit
        addressMaxLength: 500,
        // Booking form selector
        bookingFormSelector: '.booking-form, form#booking-form, form[data-booking-form]',
        // Selectors for fields
        selectors: {
            date: 'input[name="booking_date"], input[type="date"][id*="date"], [data-booking-date]',
            time: 'input[name="booking_time"], input[type="time"][id*="time"], [data-booking-time]',
            address: 'textarea[name="address"], input[name="address"], [data-booking-address]',
            fullName: 'input[name="full_name"], input[name="name"], [data-booking-name]',
            email: 'input[name="email"], input[type="email"], [data-booking-email]',
            phone: 'input[name="phone"], input[name="telephone"], [data-booking-phone]',
            service: 'select[name="service_type"], [data-booking-service]',
            hours: 'input[name="hours"], [data-booking-hours]'
        }
    };

    // ============================================================
    // DOM Ready - Initialize booking features
    // ============================================================
    document.addEventListener('DOMContentLoaded', function () {
        var form = document.querySelector(CONFIG.bookingFormSelector);
        if (!form) {
            console.warn('Booking form not found. booking.js requires a form with class "booking-form" or id "booking-form".');
            return;
        }

        var fields = resolveFields(form);

        initDateTimeValidation(form, fields);
        initAddressCounter(form, fields);
        initBookingValidation(form, fields);
        initConfirmBookingDialog(form, fields);
    });

    /**
     * Locates and caches references to all relevant form fields.
     * @param {HTMLFormElement} form - The booking form
     * @returns {Object.<string, HTMLElement|null>} Field references keyed by name
     */
    function resolveFields(form) {
        var fields = {};
        Object.keys(CONFIG.selectors).forEach(function (key) {
            fields[key] = form.querySelector(CONFIG.selectors[key]);
        });
        return fields;
    }

    // ============================================================
    // 1. Date & Time Validation
    // ============================================================

    /**
     * Initializes date and time input validation logic,
     * including min-date enforcement and minimum-notice warnings.
     *
     * Behavior:
     *  - Date input min = today (also set by main.js, re-enforced here)
     *  - When date = today, time input min = current time rounded up
     *  - When date > today, time input min = 00:00 (or business start)
     *  - If booking is within CONFIG.minNoticeHours, show inline warning
     *
     * @param {HTMLFormElement} form
     * @param {Object} fields
     */
    function initDateTimeValidation(form, fields) {
        var dateField = fields.date;
        var timeField = fields.time;

        if (!dateField && !timeField) return;

        // Ensure date field min is always today
        setDateMinToToday(dateField);

        // Update time restrictions whenever date changes
        if (dateField) {
            dateField.addEventListener('change', function () {
                updateTimeFieldBounds(dateField, timeField);
                validateBookingDateTime(dateField, timeField);
            });

            dateField.addEventListener('input', function () {
                validateBookingDateTime(dateField, timeField);
            });
        }

        if (timeField) {
            timeField.addEventListener('change', function () {
                validateBookingDateTime(dateField, timeField);
            });

            timeField.addEventListener('input', function () {
                validateBookingDateTime(dateField, timeField);
            });
        }

        // Run once to initialize time bounds for default date (today)
        updateTimeFieldBounds(dateField, timeField);
    }

    /**
     * Sets the date field's min attribute to today's date.
     * Preserves any existing min that is later than today.
     */
    function setDateMinToToday(dateField) {
        if (!dateField) return;
        var today = formatDate(new Date());
        var existingMin = dateField.getAttribute('min');
        if (!existingMin || existingMin < today) {
            dateField.setAttribute('min', today);
        }
    }

    /**
     * Adjusts the time field's min value based on the selected date.
     *  - Today: min = now (rounded up to next 5 min)
     *  - Future date: no extra restriction (respects business hours if set)
     */
    function updateTimeFieldBounds(dateField, timeField) {
        if (!timeField) return;

        var today = formatDate(new Date());
        var selectedDate = dateField ? dateField.value : null;

        if (selectedDate === today) {
            var now = new Date();
            // Round up to next 5 minutes to give user a realistic minimum
            now.setMinutes(now.getMinutes() + Math.ceil(now.getMinutes() % 5 / 1) * 5 - (now.getMinutes() % 5));
            if (now.getMinutes() % 5 !== 0) {
                now.setMinutes(now.getMinutes() + (5 - (now.getMinutes() % 5)));
            }
            var minTime = formatTime(now);

            var businessStart = timeField.getAttribute('data-business-start');
            if (businessStart && businessStart > minTime) {
                minTime = businessStart;
            }

            timeField.setAttribute('min', minTime);
        } else {
            // For future dates, allow any business hours (remove dynamic min)
            var businessStart = timeField.getAttribute('data-business-start');
            if (businessStart) {
                timeField.setAttribute('min', businessStart);
            } else {
                timeField.removeAttribute('min');
            }
        }

        var businessEnd = timeField.getAttribute('data-business-end');
        if (businessEnd) {
            timeField.setAttribute('max', businessEnd);
        }
    }

    /**
     * Validates the selected date+time combination and displays
     * inline errors or warnings (e.g. booking too soon).
     */
    function validateBookingDateTime(dateField, timeField) {
        if (!dateField || !timeField) return;

        var dateVal = dateField.value;
        var timeVal = timeField.value;
        var wrapper = (dateField.closest('.form-group, .field-wrapper, .mb-3, div') || dateField.parentNode);

        clearDateTimeWarnings(wrapper);

        if (!dateVal || !timeVal) return;

        var selectedDate = parseDateAndTime(dateVal, timeVal);
        if (!selectedDate || isNaN(selectedDate.getTime())) return;

        var now = new Date();
        var msDiff = selectedDate.getTime() - now.getTime();
        var hoursDiff = msDiff / (1000 * 60 * 60);

        // Past date/time: hard error
        if (msDiff <= 0) {
            showDateTimeWarning(
                wrapper,
                dateField,
                'Selected date and time are in the past. Please choose a future time.',
                'error'
            );
            return;
        }

        // Less than minimum notice: warning (non-blocking, user can still submit but is warned)
        if (hoursDiff < CONFIG.minNoticeHours) {
            var rounded = Math.ceil(hoursDiff * 10) / 10;
            showDateTimeWarning(
                wrapper,
                dateField,
                'Warning: Your booking is only ' + rounded + ' hours from now. We recommend at least ' + CONFIG.minNoticeHours + ' hours notice to ensure availability.',
                'warning'
            );
            return;
        }

        // Check business hours if provided
        if (isOutsideBusinessHours(timeField)) {
            showDateTimeWarning(
                wrapper,
                dateField,
                'Selected time is outside of our business hours. Please choose a time within our operating hours.',
                'error'
            );
        }
    }

    /**
     * Checks whether the selected time is outside declared business hours.
     * Uses data-business-start and data-business-end attributes on the time field.
     */
    function isOutsideBusinessHours(timeField) {
        if (!timeField) return false;
        var start = timeField.getAttribute('data-business-start');
        var end = timeField.getAttribute('data-business-end');
        if (!start || !end) return false;
        var value = timeField.value;
        if (!value) return false;
        return value < start || value > end;
    }

    /**
     * Displays a date/time-specific warning/error inline.
     */
    function showDateTimeWarning(wrapper, anchorField, message, type) {
        var warning = document.createElement('div');
        var isError = type === 'error';
        warning.className = 'datetime-warning booking-notice ' + (isError ? 'text-danger error' : 'text-warning warning');
        warning.setAttribute('data-datetime-warning', '1');
        warning.style.cssText = 'margin-top:0.5rem;font-size:0.875rem;';
        warning.textContent = message;

        if (anchorField.nextSibling) {
            anchorField.parentNode.insertBefore(warning, anchorField.nextSibling);
        } else {
            anchorField.parentNode.appendChild(warning);
        }

        if (isError) {
            anchorField.classList.add('is-invalid', 'error');
            anchorField.setAttribute('aria-invalid', 'true');
        }
    }

    /**
     * Clears any existing date/time warning/error messages.
     */
    function clearDateTimeWarnings(wrapper) {
        wrapper.querySelectorAll('[data-datetime-warning]').forEach(function (w) {
            if (w.parentNode) w.parentNode.removeChild(w);
        });
        // Also remove error classes from date/time fields inside this wrapper
        wrapper.querySelectorAll('input[type="date"], input[type="time"]').forEach(function (f) {
            f.classList.remove('is-invalid', 'error');
            f.removeAttribute('aria-invalid');
        });
    }

    // ============================================================
    // 2. Address Field Character Counter
    // ============================================================

    /**
     * Adds a live character counter below the address input,
     * turning red when approaching/exceeding the limit.
     */
    function initAddressCounter(form, fields) {
        var addressField = fields.address;
        if (!addressField) return;

        var maxLength = CONFIG.addressMaxLength;

        // If the field already has a maxlength, respect that instead
        var attrMaxLength = addressField.getAttribute('maxlength');
        if (attrMaxLength) {
            maxLength = parseInt(attrMaxLength, 10);
        } else {
            addressField.setAttribute('maxlength', String(maxLength));
        }

        // Create counter element
        var counter = document.createElement('div');
        counter.className = 'address-char-counter form-text small';
        counter.setAttribute('data-address-counter', '1');
        counter.style.cssText = 'text-align:right;margin-top:0.25rem;';

        if (addressField.nextSibling) {
            addressField.parentNode.insertBefore(counter, addressField.nextSibling);
        } else {
            addressField.parentNode.appendChild(counter);
        }

        function updateCounter() {
            var len = (addressField.value || '').length;
            counter.textContent = len + ' / ' + maxLength + ' characters';

            // Color coding for nearing/exceeding limit
            counter.classList.remove('text-danger', 'text-warning', 'text-muted');
            if (len >= maxLength) {
                counter.classList.add('text-danger');
            } else if (len >= maxLength * 0.9) {
                counter.classList.add('text-warning');
            } else {
                counter.classList.add('text-muted');
            }
        }

        // Listen to all relevant input events
        addressField.addEventListener('input', updateCounter);
        addressField.addEventListener('propertychange', updateCounter);
        addressField.addEventListener('paste', function () {
            setTimeout(updateCounter, 0);
        });

        updateCounter();
    }

    // ============================================================
    // 3. Comprehensive Booking Form Validation
    // ============================================================

    /**
     * Attaches full submit + per-field validation to the booking form,
     * including: required checks, email format, phone format, min/max
     * hours, service selection, date + time validation, and min notice.
     */
    function initBookingValidation(form, fields) {
        // --- Submit-time validation --------------------------------
        form.addEventListener('submit', function (e) {
            var errors = validateAllBookingFields(form, fields);
            clearAllInlineErrors(form);

            if (Object.keys(errors).length > 0) {
                e.preventDefault();
                displayInlineErrors(form, errors);
                focusFirstInvalidField(form, errors);
                return;
            }

            // If we get here, form will continue either to confirm dialog or to native submit
        });

        // --- Per-field live validation (clear error as user fixes) -
        var validators = {
            fullName: validateFullName,
            email: validateEmail,
            phone: validatePhone,
            service: validateService,
            hours: validateHours,
            date: validateDate,
            time: validateTime,
            address: validateAddress
        };

        Object.keys(validators).forEach(function (key) {
            var field = fields[key];
            if (!field) return;

            var validate = validators[key];

            field.addEventListener('blur', function () {
                runSingleValidation(form, field, key, validate);
            });

            field.addEventListener('change', function () {
                runSingleValidation(form, field, key, validate);
            });

            field.addEventListener('input', function () {
                // Only clear error during typing; don't re-show until blur/change
                if (hasInlineError(form, field)) {
                    var err = validate(field, fields);
                    if (!err) {
                        clearSingleInlineError(form, field);
                    }
                }
            });
        });
    }

    /**
     * Runs a single-field validator and updates inline UI accordingly.
     */
    function runSingleValidation(form, field, key, validateFn) {
        // Wrap to match validateAllBookingFields signature (value + fields)
        var fields = resolveFields(form);
        var err = validateFn(field, fields);
        clearSingleInlineError(form, field);
        if (err) {
            displaySingleInlineError(form, field, err);
        }
    }

    /**
     * Runs every booking validator and returns an error map.
     * @returns {Object.<string, string>} { fieldKey: errorMessage }
     */
    function validateAllBookingFields(form, fields) {
        var errors = {};

        // Full name
        if (fields.fullName) {
            var nameErr = validateFullName(fields.fullName, fields);
            if (nameErr) errors.fullName = nameErr;
        }

        // Email
        if (fields.email) {
            var emailErr = validateEmail(fields.email, fields);
            if (emailErr) errors.email = emailErr;
        }

        // Phone
        if (fields.phone) {
            var phoneErr = validatePhone(fields.phone, fields);
            if (phoneErr) errors.phone = phoneErr;
        }

        // Service type
        if (fields.service) {
            var serviceErr = validateService(fields.service, fields);
            if (serviceErr) errors.service = serviceErr;
        }

        // Hours/duration
        if (fields.hours) {
            var hoursErr = validateHours(fields.hours, fields);
            if (hoursErr) errors.hours = hoursErr;
        }

        // Date
        if (fields.date) {
            var dateErr = validateDate(fields.date, fields);
            if (dateErr) errors.date = dateErr;
        }

        // Time (depends on date being valid)
        if (fields.time) {
            var timeErr = validateTime(fields.time, fields);
            if (timeErr) errors.time = timeErr;
        }

        // Combined date+time notice check (converted to error at submit)
        if (fields.date && fields.time && fields.date.value && fields.time.value) {
            var dateTime = parseDateAndTime(fields.date.value, fields.time.value);
            if (dateTime && !isNaN(dateTime.getTime())) {
                var msDiff = dateTime.getTime() - Date.now();
                if (msDiff <= 0) {
                    errors.time = 'Booking time must be in the future.';
                } else if (msDiff < CONFIG.minNoticeHours * 60 * 60 * 1000) {
                    // Enforce minimum notice at submit (can be relaxed by increasing CONFIG.minNoticeHours)
                    errors.time = 'Booking must be at least ' + CONFIG.minNoticeHours + ' hours from now. Please choose a later time.';
                }
            }
        }

        // Address
        if (fields.address) {
            var addressErr = validateAddress(fields.address, fields);
            if (addressErr) errors.address = addressErr;
        }

        // Custom / extra required fields (not explicitly handled above)
        form.querySelectorAll('[required]').forEach(function (f) {
            var key = (f.name || f.id || '').replace(/[\[\]]/g, '_');
            if (errors[key]) return; // Already handled above
            if (f.type === 'checkbox') {
                if (!f.checked) errors[key] = 'This field is required.';
            } else {
                var v = typeof f.value === 'string' ? f.value.trim() : f.value;
                if (!v) errors[key] = 'This field is required.';
            }
        });

        return errors;
    }

    // ----- Individual field validators -------------------------

    function validateFullName(field) {
        var value = (field.value || '').trim();
        if (!value) return 'Please enter your full name.';
        if (value.length < 2) return 'Name must be at least 2 characters.';
        if (value.length > 100) return 'Name cannot exceed 100 characters.';
        if (!/^[A-Za-z\u00C0-\u01FF\u0100-\u017F'\- ]+$/.test(value)) return 'Name may only contain letters, spaces, hyphens, and apostrophes.';
        return null;
    }

    function validateEmail(field) {
        var value = (field.value || '').trim();
        if (!value) return 'Please enter your email address.';
        if (value.length > 254) return 'Email address is too long.';
        var regex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
        if (!regex.test(value)) return 'Please enter a valid email address (e.g. name@example.com).';
        return null;
    }

    function validatePhone(field) {
        var value = (field.value || '').trim();
        if (!value) return 'Please enter your phone number.';
        var digits = value.replace(/\D/g, '');
        if (digits.length < 7) return 'Phone number must contain at least 7 digits.';
        if (digits.length > 15) return 'Phone number cannot exceed 15 digits.';
        if (!/^[+\d][\d\s\-\(\)\.]*$/.test(value)) return 'Phone number contains invalid characters.';
        return null;
    }

    function validateService(field) {
        if (field.tagName.toLowerCase() === 'select') {
            var v = field.value;
            if (!v || v === '' || v === '0' || v === 'null') {
                return 'Please select a service type.';
            }
        } else if (field.type === 'radio') {
            var groupName = field.name;
            var checked = document.querySelector('input[name="' + groupName + '"]:checked');
            if (!checked) return 'Please select a service type.';
        } else {
            if (!(field.value || '').trim()) return 'Please enter or select a service type.';
        }
        return null;
    }

    function validateHours(field) {
        var raw = field.value;
        if (raw === '' || raw == null) return 'Please enter the number of hours.';
        var hours = parseFloat(raw);
        if (isNaN(hours)) return 'Hours must be a number.';
        var min = parseFloat(field.getAttribute('min')) || 1;
        var max = parseFloat(field.getAttribute('max')) || 24;
        if (hours < min) return 'Minimum booking duration is ' + min + ' hour(s).';
        if (hours > max) return 'Maximum booking duration is ' + max + ' hour(s).';
        if (hours * 4 !== Math.round(hours * 4)) return 'Hours can only be booked in 15-minute (0.25 hour) increments.';
        return null;
    }

    function validateDate(field) {
        var value = field.value;
        if (!value) return 'Please select a booking date.';
        var todayStr = formatDate(new Date());
        if (value < todayStr) return 'Booking date cannot be in the past.';
        // Max horizon: warn if more than 90 days out
        var maxDays = 90;
        var horizon = new Date();
        horizon.setDate(horizon.getDate() + maxDays);
        var horizonStr = formatDate(horizon);
        if (value > horizonStr) return 'Bookings cannot be made more than ' + maxDays + ' days in advance.';
        return null;
    }

    function validateTime(field, fields) {
        var value = field.value;
        if (!value) return 'Please select a booking time.';
        if (value.length < 4) return 'Please select a valid time.';
        // Business hours check
        var start = field.getAttribute('data-business-start');
        var end = field.getAttribute('data-business-end');
        if (start && end) {
            if (value < start || value > end) {
                return 'Please select a time between ' + formatTimeDisplay(start) + ' and ' + formatTimeDisplay(end) + '.';
            }
        }
        return null;
    }

    function validateAddress(field) {
        var value = (field.value || '').trim();
        if (!value) return 'Please enter your service address.';
        var max = parseInt(field.getAttribute('maxlength'), 10) || CONFIG.addressMaxLength;
        if (value.length > max) return 'Address cannot exceed ' + max + ' characters.';
        if (value.length < 10) return 'Please enter a complete address (at least 10 characters).';
        return null;
    }

    // ----- Inline error display helpers ------------------------

    /**
     * Renders error messages next to each invalid field and marks
     * fields with error styling / aria attributes.
     */
    function displayInlineErrors(form, errors) {
        Object.keys(errors).forEach(function (key) {
            var field = findFieldByKey(form, key);
            if (field) {
                displaySingleInlineError(form, field, errors[key]);
            }
        });
    }

    /**
     * Displays a single inline error next to a field.
     */
    function displaySingleInlineError(form, field, message) {
        field.classList.add('is-invalid', 'error');
        field.setAttribute('aria-invalid', 'true');

        // Remove any existing error for this field first
        clearSingleInlineError(form, field);

        var errorEl = document.createElement('div');
        errorEl.className = 'booking-field-error invalid-feedback text-danger small mt-1';
        errorEl.setAttribute('data-booking-error-for', field.id || field.name || '');
        errorEl.textContent = message;

        if (field.nextSibling) {
            field.parentNode.insertBefore(errorEl, field.nextSibling);
        } else {
            field.parentNode.appendChild(errorEl);
        }
    }

    /**
     * Removes all inline error messages and error classes from the form.
     */
    function clearAllInlineErrors(form) {
        form.querySelectorAll('[data-booking-error-for]').forEach(function (el) {
            if (el.parentNode) el.parentNode.removeChild(el);
        });
        form.querySelectorAll('.is-invalid, .error').forEach(function (el) {
            el.classList.remove('is-invalid', 'error');
            el.removeAttribute('aria-invalid');
        });
    }

    /**
     * Removes a single inline error for the specified field.
     */
    function clearSingleInlineError(form, field) {
        if (!field) return;
        field.classList.remove('is-invalid', 'error');
        field.removeAttribute('aria-invalid');

        var identifier = field.id || field.name;
        form.querySelectorAll('[data-booking-error-for="' + identifier + '"]').forEach(function (el) {
            if (el.parentNode) el.parentNode.removeChild(el);
        });
    }

    /**
     * Returns true if the given field currently has an inline error displayed.
     */
    function hasInlineError(form, field) {
        return field.classList.contains('is-invalid') || field.classList.contains('error');
    }

    /**
     * Moves focus to the first field that has an error.
     */
    function focusFirstInvalidField(form, errors) {
        var orderedKeys = ['fullName', 'email', 'phone', 'service', 'hours', 'date', 'time', 'address'];
        for (var i = 0; i < orderedKeys.length; i++) {
            var k = orderedKeys[i];
            if (errors[k]) {
                var f = findFieldByKey(form, k);
                if (f) {
                    f.focus();
                    if (typeof f.reportValidity === 'function') {
                        try { f.reportValidity(); } catch (e) { /* ignore */ }
                    }
                    return;
                }
            }
        }
        // Fallback: any field in the errors map
        var firstKey = Object.keys(errors)[0];
        if (firstKey) {
            var ff = findFieldByKey(form, firstKey);
            if (ff) ff.focus();
        }
    }

    /**
     * Maps a field key to the actual field element in the form.
     */
    function findFieldByKey(form, key) {
        var selector = CONFIG.selectors[key];
        if (selector) {
            var direct = form.querySelector(selector);
            if (direct) return direct;
        }
        // Fallback: search by name or id
        return form.querySelector('[name="' + key + '"], [id="' + key + '"], [name="' + key + '[]"]');
    }

    // ============================================================
    // 4. Confirm Booking Dialog on Submit
    // ============================================================

    /**
     * Intercepts valid form submissions and shows a custom summary
     * confirmation dialog before sending data to the server.
     * If the user confirms, the form is allowed to submit naturally.
     */
    function initConfirmBookingDialog(form, fields) {
        // We need to capture submit AFTER validation runs. Validation is attached
        // via addEventListener earlier (same event, same phase). To guarantee order,
        // use a capture-phase listener OR wrap via preventDefault + manual submit flag.
        //
        // Approach: override submit flow with a confirmation gate.

        var isConfirming = false;

        form.addEventListener('submit', function (e) {
            // If already confirmed, allow through
            if (isConfirming) return;

            // Prevent native submit; we will trigger it after confirmation
            e.preventDefault();

            // Run validation again in case some other handler skipped
            var errors = validateAllBookingFields(form, fields);
            clearAllInlineErrors(form);

            if (Object.keys(errors).length > 0) {
                displayInlineErrors(form, errors);
                focusFirstInvalidField(form, errors);
                return;
            }

            // Build the summary and show dialog
            var summary = buildBookingSummary(form, fields);
            showConfirmDialog(summary, {
                onConfirm: function () {
                    isConfirming = true;
                    // Use native submit (bypasses our listener)
                    var nativeSubmit = HTMLFormElement.prototype.submit;
                    nativeSubmit.call(form);
                },
                onCancel: function () {
                    isConfirming = false;
                }
            });
        }, true /* use capture to ensure we see it first */);
    }

    /**
     * Compiles a human-readable booking summary object from the form.
     */
    function buildBookingSummary(form, fields) {
        var summary = {
            title: 'Confirm Your Booking',
            items: []
        };

        if (fields.fullName && fields.fullName.value) {
            summary.items.push({ label: 'Name', value: fields.fullName.value.trim() });
        }
        if (fields.email && fields.email.value) {
            summary.items.push({ label: 'Email', value: fields.email.value.trim() });
        }
        if (fields.phone && fields.phone.value) {
            summary.items.push({ label: 'Phone', value: fields.phone.value.trim() });
        }
        if (fields.service) {
            var serviceVal = fields.service.tagName.toLowerCase() === 'select'
                ? (fields.service.options[fields.service.selectedIndex]?.textContent || fields.service.value)
                : fields.service.value;
            if (serviceVal) summary.items.push({ label: 'Service', value: serviceVal.trim() });
        }
        if (fields.hours && fields.hours.value) {
            summary.items.push({ label: 'Duration', value: fields.hours.value + ' hour(s)' });
        }
        if (fields.date && fields.date.value) {
            summary.items.push({ label: 'Date', value: formatDateDisplay(fields.date.value) });
        }
        if (fields.time && fields.time.value) {
            summary.items.push({ label: 'Time', value: formatTimeDisplay(fields.time.value) });
        }
        if (fields.address && fields.address.value) {
            summary.items.push({ label: 'Address', value: fields.address.value.trim() });
        }

        // Add-on services (checkboxes)
        var addons = form.querySelectorAll('input[name="addons[]"]:checked, [data-booking-addon]:checked');
        if (addons.length > 0) {
            var addonNames = Array.from(addons).map(function (a) {
                return (a.closest('label')?.textContent || a.value || '').trim();
            }).filter(Boolean);
            if (addonNames.length) summary.items.push({ label: 'Add-ons', value: addonNames.join(', ') });
        }

        // Total price if available
        var totalEl = form.querySelector('[data-booking-price-total], .booking-total-price, #total-price');
        if (totalEl && totalEl.textContent) {
            summary.items.push({ label: 'Total Price', value: totalEl.textContent.trim(), highlight: true });
        }

        return summary;
    }

    /**
     * Renders and displays a modal confirmation dialog.
     * Falls back to window.confirm if modal creation fails.
     */
    function showConfirmDialog(summary, handlers) {
        try {
            var existing = document.querySelector('.booking-confirm-modal');
            if (existing) existing.remove();

            var modal = document.createElement('div');
            modal.className = 'booking-confirm-modal';
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');
            modal.setAttribute('aria-labelledby', 'booking-confirm-title');
            modal.style.cssText = [
                'position:fixed;top:0;left:0;width:100%;height:100%;',
                'background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;',
                'z-index:9999;padding:1rem;box-sizing:border-box;'
            ].join('');

            var dialog = document.createElement('div');
            dialog.className = 'booking-confirm-dialog';
            dialog.style.cssText = [
                'background:#fff;border-radius:8px;max-width:520px;width:100%;',
                'box-shadow:0 20px 50px rgba(0,0,0,0.2);overflow:hidden;',
                'font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;'
            ].join('');

            // Header
            var header = document.createElement('div');
            header.style.cssText = 'padding:1.25rem 1.5rem;border-bottom:1px solid #eaecef;background:#f8f9fa;';
            header.innerHTML = '<h3 id="booking-confirm-title" style="margin:0;font-size:1.25rem;">' + escapeHtml(summary.title) + '</h3>';
            dialog.appendChild(header);

            // Body / Summary
            var body = document.createElement('div');
            body.style.cssText = 'padding:1.25rem 1.5rem;max-height:60vh;overflow-y:auto;';

            var itemsHtml = summary.items.map(function (item) {
                var valueStyle = item.highlight ? 'font-weight:bold;color:#0b5ed7;font-size:1.1rem;' : '';
                return (
                    '<div style="display:flex;justify-content:space-between;gap:1rem;padding:0.5rem 0;border-bottom:1px dashed #eee;">' +
                        '<span style="color:#555;font-weight:500;min-width:40%;">' + escapeHtml(item.label) + '</span>' +
                        '<span style="text-align:right;word-break:break-word;' + valueStyle + '">' + escapeHtml(item.value) + '</span>' +
                    '</div>'
                );
            }).join('');

            body.innerHTML = '<p style="margin:0 0 1rem;color:#444;">Please review your booking details before confirming:</p>' + itemsHtml;
            dialog.appendChild(body);

            // Footer / Buttons
            var footer = document.createElement('div');
            footer.style.cssText = 'padding:1rem 1.5rem;border-top:1px solid #eaecef;display:flex;justify-content:flex-end;gap:0.75rem;';

            var cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.className = 'btn btn-secondary';
            cancelBtn.textContent = 'Cancel';
            cancelBtn.style.cssText = 'padding:0.5rem 1.25rem;border-radius:6px;border:1px solid #ccc;background:#fff;cursor:pointer;font-size:0.95rem;';

            var confirmBtn = document.createElement('button');
            confirmBtn.type = 'button';
            confirmBtn.className = 'btn btn-primary';
            confirmBtn.textContent = 'Confirm Booking';
            confirmBtn.style.cssText = 'padding:0.5rem 1.25rem;border-radius:6px;border:1px solid #0b5ed7;background:#0b5ed7;color:#fff;cursor:pointer;font-size:0.95rem;font-weight:500;';

            footer.appendChild(cancelBtn);
            footer.appendChild(confirmBtn);
            dialog.appendChild(footer);

            modal.appendChild(dialog);
            document.body.appendChild(modal);
            document.body.style.overflow = 'hidden';

            function closeModal() {
                if (modal.parentNode) modal.parentNode.removeChild(modal);
                document.body.style.overflow = '';
            }

            cancelBtn.addEventListener('click', function () {
                closeModal();
                if (handlers.onCancel) handlers.onCancel();
            });

            confirmBtn.addEventListener('click', function () {
                confirmBtn.disabled = true;
                confirmBtn.textContent = 'Submitting...';
                closeModal();
                if (handlers.onConfirm) handlers.onConfirm();
            });

            // Backdrop click cancels
            modal.addEventListener('click', function (e) {
                if (e.target === modal) {
                    closeModal();
                    if (handlers.onCancel) handlers.onCancel();
                }
            });

            // Escape cancels
            var escHandler = function (e) {
                if (e.key === 'Escape') {
                    closeModal();
                    document.removeEventListener('keydown', escHandler);
                    if (handlers.onCancel) handlers.onCancel();
                }
            };
            document.addEventListener('keydown', escHandler);

            // Focus confirm button
            setTimeout(function () { confirmBtn.focus(); }, 0);

        } catch (err) {
            // Fallback: native confirm
            var text = summary.title + '\n\n' + summary.items.map(function (i) { return i.label + ': ' + i.value; }).join('\n') + '\n\nProceed with this booking?';
            if (window.confirm(text)) {
                if (handlers.onConfirm) handlers.onConfirm();
            } else {
                if (handlers.onCancel) handlers.onCancel();
            }
        }
    }

    // ============================================================
    // Date/Time Formatting Utilities
    // ============================================================

    /**
     * Formats a Date as YYYY-MM-DD (suitable for <input type="date"> value).
     */
    function formatDate(date) {
        var y = date.getFullYear();
        var m = String(date.getMonth() + 1).padStart(2, '0');
        var d = String(date.getDate()).padStart(2, '0');
        return y + '-' + m + '-' + d;
    }

    /**
     * Formats a Date as HH:mm (suitable for <input type="time"> value) using local time.
     */
    function formatTime(date) {
        var h = String(date.getHours()).padStart(2, '0');
        var m = String(date.getMinutes()).padStart(2, '0');
        return h + ':' + m;
    }

    /**
     * Parses a date string (YYYY-MM-DD) + time string (HH:mm) into a single Date.
     * Returns null if either value is missing or invalid.
     */
    function parseDateAndTime(dateStr, timeStr) {
        if (!dateStr || !timeStr) return null;
        var parts = dateStr.split('-');
        var timeParts = timeStr.split(':');
        if (parts.length < 3 || timeParts.length < 2) return null;
        var y = parseInt(parts[0], 10);
        var mo = parseInt(parts[1], 10) - 1;
        var d = parseInt(parts[2], 10);
        var h = parseInt(timeParts[0], 10);
        var mi = parseInt(timeParts[1], 10);
        if ([y, mo, d, h, mi].some(function (v) { return isNaN(v); })) return null;
        return new Date(y, mo, d, h, mi, 0, 0);
    }

    /**
     * Formats a YYYY-MM-DD date for display in the user's locale (e.g. "Mon, Jan 5, 2026").
     */
    function formatDateDisplay(dateStr) {
        if (!dateStr) return '';
        var d = parseDateAndTime(dateStr, '00:00');
        if (!d) return dateStr;
        try {
            return d.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
        } catch (e) {
            return dateStr;
        }
    }

    /**
     * Converts a 24-hour HH:mm time to a localized display format (e.g. "2:30 PM").
     * Falls back to the original format if the Intl API is unavailable.
     */
    function formatTimeDisplay(timeStr) {
        if (!timeStr) return '';
        var parts = timeStr.split(':');
        if (parts.length < 2) return timeStr;
        var h = parseInt(parts[0], 10);
        var m = parseInt(parts[1], 10);
        if (isNaN(h) || isNaN(m)) return timeStr;
        try {
            var dummy = new Date(2000, 0, 1, h, m, 0);
            return dummy.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
        } catch (e) {
            return timeStr;
        }
    }

    /**
     * Escapes HTML special characters for safe string insertion.
     * @param {string} str - Raw string
     * @returns {string} HTML-safe string
     */
    function escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

})();
