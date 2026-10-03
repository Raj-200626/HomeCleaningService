/**
 * Main JavaScript file for Home Cleaning Service
 * Handles common UI interactions across all pages
 *
 * Features:
 * - Flash message auto-hide after 5 seconds
 * - Smooth scroll for anchor links
 * - Set minimum date to today on all date inputs
 * - Simple required field form validation
 * - Prevent double-click form submission
 * - Mobile navbar toggling
 * - Booking form dynamic price display
 */

(function () {
    'use strict';

    // ============================================================
    // DOM Ready - Initialize all features once DOM is fully loaded
    // ============================================================
    document.addEventListener('DOMContentLoaded', function () {
        initFlashMessages();
        initSmoothScroll();
        initDateInputMinDate();
        initFormValidation();
        initPreventDoubleSubmit();
        initMobileNavbar();
        initBookingPriceDisplay();
    });

    // ============================================================
    // 1. Flash Message Auto-Hide
    // ============================================================

    /**
     * Auto-hides flash/alert messages after 5 seconds.
     * Targets elements with class 'flash-message' or 'alert'.
     */
    function initFlashMessages() {
        var flashMessages = document.querySelectorAll('.flash-message, .alert');

        flashMessages.forEach(function (message) {
            // Create close button if not already present
            if (!message.querySelector('.flash-close')) {
                var closeBtn = document.createElement('button');
                closeBtn.type = 'button';
                closeBtn.className = 'flash-close';
                closeBtn.setAttribute('aria-label', 'Close message');
                closeBtn.innerHTML = '&times;';
                closeBtn.style.cssText = 'float:right;background:none;border:none;font-size:1.5rem;line-height:1;cursor:pointer;opacity:0.7;';
                message.appendChild(closeBtn);

                closeBtn.addEventListener('click', function () {
                    hideFlashMessage(message);
                });
            }

            // Auto-hide after 5 seconds
            setTimeout(function () {
                hideFlashMessage(message);
            }, 5000);
        });
    }

    /**
     * Animates and removes a flash message element.
     * @param {HTMLElement} element - Flash message element to hide
     */
    function hideFlashMessage(element) {
        if (!element) return;

        element.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
        element.style.opacity = '0';
        element.style.transform = 'translateY(-10px)';

        setTimeout(function () {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
        }, 400);
    }

    // ============================================================
    // 2. Smooth Scroll for Anchor Links
    // ============================================================

    /**
     * Enables smooth scrolling for internal anchor links (href="#...").
     * Skips links with 'no-smooth-scroll' class or empty hrefs.
     */
    function initSmoothScroll() {
        var anchorLinks = document.querySelectorAll('a[href^="#"]');

        anchorLinks.forEach(function (link) {
            var href = link.getAttribute('href');

            // Skip links with no target or explicit opt-out
            if (!href || href === '#' || link.classList.contains('no-smooth-scroll')) {
                return;
            }

            link.addEventListener('click', function (e) {
                var targetId = href.substring(1);
                var targetElement = document.getElementById(targetId);

                if (targetElement) {
                    e.preventDefault();

                    // Close mobile nav if open before scrolling
                    closeMobileNav();

                    targetElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });

                    // Update URL hash without jumping
                    history.pushState(null, '', href);
                }
            });
        });
    }

    // ============================================================
    // 3. Set Minimum Date on Date Inputs
    // ============================================================

    /**
     * Sets the 'min' attribute of all date inputs to today's date,
     * preventing selection of past dates.
     */
    function initDateInputMinDate() {
        var dateInputs = document.querySelectorAll('input[type="date"]');
        var today = new Date();
        var yyyy = today.getFullYear();
        var mm = String(today.getMonth() + 1).padStart(2, '0');
        var dd = String(today.getDate()).padStart(2, '0');
        var minDate = yyyy + '-' + mm + '-' + dd;

        dateInputs.forEach(function (input) {
            // Only override min if not explicitly set to a later date
            var existingMin = input.getAttribute('min');
            if (!existingMin || existingMin < minDate) {
                input.setAttribute('min', minDate);
            }
        });
    }

    // ============================================================
    // 4. Simple Form Validation (Required Fields)
    // ============================================================

    /**
     * Attaches submit listeners to validate required fields.
     * Checks inputs, selects, and textareas with 'required' attribute.
     * Shows inline error messages and focuses first invalid field.
     */
    function initFormValidation() {
        var forms = document.querySelectorAll('form');

        forms.forEach(function (form) {
            // Skip forms that opt-out or are booking-specific (handled by booking.js)
            if (form.classList.contains('no-validation') || form.classList.contains('booking-form')) {
                return;
            }

            form.addEventListener('submit', function (e) {
                var requiredFields = form.querySelectorAll('[required]');
                var firstInvalidField = null;

                requiredFields.forEach(function (field) {
                    var fieldWrapper = getFieldWrapper(field);
                    var isValid = isFieldValid(field);

                    // Clear previous error for this field
                    clearFieldError(fieldWrapper, field);

                    if (!isValid) {
                        e.preventDefault();
                        showFieldError(fieldWrapper, field, 'This field is required.');
                        if (!firstInvalidField) {
                            firstInvalidField = field;
                        }
                    }
                });

                if (firstInvalidField) {
                    firstInvalidField.focus();
                    if (typeof firstInvalidField.reportValidity === 'function') {
                        firstInvalidField.reportValidity();
                    }
                }
            });

            // Clear validation errors as user types
            form.querySelectorAll('[required]').forEach(function (field) {
                field.addEventListener('input', function () {
                    var fieldWrapper = getFieldWrapper(field);
                    if (isFieldValid(field)) {
                        clearFieldError(fieldWrapper, field);
                    }
                });
                field.addEventListener('change', function () {
                    var fieldWrapper = getFieldWrapper(field);
                    if (isFieldValid(field)) {
                        clearFieldError(fieldWrapper, field);
                    }
                });
            });
        });
    }

    /**
     * Checks whether a required field has a non-empty value.
     * @param {HTMLElement} field - Input/select/textarea element
     * @returns {boolean} True if valid (non-empty for required fields)
     */
    function isFieldValid(field) {
        if (!field.hasAttribute('required')) return true;

        var value = field.value;

        if (field.type === 'checkbox') {
            return field.checked;
        }

        if (field.tagName.toLowerCase() === 'select') {
            return value !== '' && value !== null;
        }

        return typeof value === 'string' && value.trim() !== '';
    }

    /**
     * Finds the closest wrapper element (field group) for a form field.
     * @param {HTMLElement} field - Form field element
     * @returns {HTMLElement} The wrapper or the field itself if none found
     */
    function getFieldWrapper(field) {
        return field.closest('.form-group, .field-wrapper, .mb-3, div') || field.parentNode;
    }

    /**
     * Displays an inline error message for a form field.
     * @param {HTMLElement} wrapper - Field wrapper element
     * @param {HTMLElement} field - Form field element
     * @param {string} message - Error message text
     */
    function showFieldError(wrapper, field, message) {
        field.classList.add('is-invalid', 'error');
        field.setAttribute('aria-invalid', 'true');

        // Remove existing error message to avoid duplicates
        clearFieldError(wrapper, field, false);

        var errorEl = document.createElement('div');
        errorEl.className = 'field-error invalid-feedback text-danger small mt-1';
        errorEl.setAttribute('data-error-for', field.id || field.name);
        errorEl.textContent = message;

        if (field.nextSibling) {
            field.parentNode.insertBefore(errorEl, field.nextSibling);
        } else {
            field.parentNode.appendChild(errorEl);
        }
    }

    /**
     * Removes error state and messages from a field.
     * @param {HTMLElement} wrapper - Field wrapper element
     * @param {HTMLElement} field - Form field element
     * @param {boolean} [clearClasses=true] - Whether to remove error classes
     */
    function clearFieldError(wrapper, field, clearClasses) {
        clearClasses = typeof clearClasses === 'undefined' ? true : clearClasses;

        if (clearClasses) {
            field.classList.remove('is-invalid', 'error');
            field.removeAttribute('aria-invalid');
        }

        var identifier = field.id || field.name;
        var existingErrors = wrapper.querySelectorAll('[data-error-for="' + identifier + '"]');
        existingErrors.forEach(function (err) {
            if (err.parentNode) {
                err.parentNode.removeChild(err);
            }
        });
    }

    // ============================================================
    // 5. Prevent Double-Click Form Submission
    // ============================================================

    /**
     * Disables submit buttons on form submit to prevent duplicate
     * submissions. Re-enables after 8 seconds as a safety fallback.
     */
    function initPreventDoubleSubmit() {
        var forms = document.querySelectorAll('form');

        forms.forEach(function (form) {
            form.addEventListener('submit', function (e) {
                var submitButtons = form.querySelectorAll('button[type="submit"], input[type="submit"]');

                submitButtons.forEach(function (btn) {
                    if (!btn.disabled) {
                        btn.disabled = true;
                        btn.setAttribute('data-original-text', btn.textContent || btn.value);

                        if (btn.tagName.toLowerCase() === 'input') {
                            btn.value = 'Processing...';
                        } else {
                            btn.innerHTML = 'Processing...';
                        }

                        // Safety re-enable after 8 seconds
                        setTimeout(function () {
                            btn.disabled = false;
                            var original = btn.getAttribute('data-original-text');
                            if (original) {
                                if (btn.tagName.toLowerCase() === 'input') {
                                    btn.value = original;
                                } else {
                                    btn.textContent = original;
                                }
                            }
                        }, 8000);
                    }
                });
            });
        });
    }

    // ============================================================
    // 6. Mobile Navbar Toggling
    // ============================================================

    /**
     * Toggles mobile navigation menu open/closed when the
     * hamburger/toggle button is clicked.
     */
    function initMobileNavbar() {
        var navToggle = document.querySelector('[data-nav-toggle], [data-toggle="collapse"], .navbar-toggler');
        var navTarget = findNavTarget(navToggle);

        if (navToggle && navTarget) {
            navToggle.addEventListener('click', function () {
                toggleMobileNav(navToggle, navTarget);
            });

            // Close nav when clicking a link inside it
            navTarget.querySelectorAll('a').forEach(function (link) {
                link.addEventListener('click', function () {
                    closeMobileNav(navToggle, navTarget);
                });
            });

            // Close nav when clicking outside
            document.addEventListener('click', function (e) {
                if (navTarget.classList.contains('show', 'open', 'active', 'expanded')) {
                    if (!navTarget.contains(e.target) && !navToggle.contains(e.target)) {
                        closeMobileNav(navToggle, navTarget);
                    }
                }
            });

            // Close nav on Escape key
            document.addEventListener('keydown', function (e) {
                if (e.key === 'Escape') {
                    closeMobileNav(navToggle, navTarget);
                }
            });
        }
    }

    /**
     * Finds the navigation target element from a toggle button.
     * @param {HTMLElement} toggle - Navbar toggle button
     * @returns {HTMLElement|null} Nav target element
     */
    function findNavTarget(toggle) {
        if (!toggle) return null;

        var targetId = toggle.getAttribute('data-target') || toggle.getAttribute('href') || toggle.getAttribute('aria-controls');
        if (targetId && targetId.charAt(0) === '#') {
            return document.querySelector(targetId);
        }

        // Fallback: search common navbar containers in DOM
        return toggle.closest('.navbar, .nav-container')?.querySelector('.navbar-collapse, .nav-menu, .mobile-menu, nav ul, .nav-links') || null;
    }

    /**
     * Toggles mobile navigation open/closed state.
     * @param {HTMLElement} toggle - Navbar toggle button
     * @param {HTMLElement} target - Navigation menu element
     */
    function toggleMobileNav(toggle, target) {
        var isOpen = target.classList.contains('show') || target.classList.contains('open') || target.classList.contains('active') || target.classList.contains('expanded');

        if (isOpen) {
            closeMobileNav(toggle, target);
        } else {
            openMobileNav(toggle, target);
        }
    }

    /**
     * Opens the mobile navigation menu.
     */
    function openMobileNav(toggle, target) {
        target.classList.add('show', 'open', 'active', 'expanded');
        if (toggle) {
            toggle.classList.add('open', 'active');
            toggle.setAttribute('aria-expanded', 'true');
        }
    }

    /**
     * Closes the mobile navigation menu.
     */
    function closeMobileNav(toggle, target) {
        // If no explicit args provided, attempt to find them in the DOM
        if (!toggle || !target) {
            var t = document.querySelector('[data-nav-toggle], [data-toggle="collapse"], .navbar-toggler');
            if (t) toggle = t;
            var navTarget = findNavTarget(toggle);
            if (navTarget) target = navTarget;
        }

        if (target) {
            target.classList.remove('show', 'open', 'active', 'expanded');
        }
        if (toggle) {
            toggle.classList.remove('open', 'active');
            toggle.setAttribute('aria-expanded', 'false');
        }
    }

    // ============================================================
    // 7. Booking Form Dynamic Price Display
    // ============================================================

    /**
     * Calculates and displays the booking price in real time
     * as the user selects service type, number of hours, add-ons, etc.
     *
     * Expected form data attributes (configurable):
     *   - Container: [data-booking-price-container]
     *   - Service type select/input: [data-booking-service] (value contains JSON {price: number} or flat price)
     *   - Hours input: [data-booking-hours]
     *   - Addon checkboxes: [data-booking-addon="price"]
     *   - Output element: [data-booking-price-total] or [data-booking-price-breakdown]
     */
    function initBookingPriceDisplay() {
        var priceContainer = document.querySelector('[data-booking-price-container]') || document.querySelector('.booking-price-container');
        if (!priceContainer) return;

        var serviceField = priceContainer.querySelector('[data-booking-service]') || document.querySelector('[name="service_type"]');
        var hoursField = priceContainer.querySelector('[data-booking-hours]') || document.querySelector('[name="hours"], [name="duration"], [name="num_hours"]');
        var addonFields = priceContainer.querySelectorAll('[data-booking-addon]') || document.querySelectorAll('input[name="addons[]"]');
        var totalOutput = priceContainer.querySelector('[data-booking-price-total]') || document.querySelector('.booking-total-price, #total-price');
        var breakdownOutput = priceContainer.querySelector('[data-booking-price-breakdown]') || document.querySelector('.booking-price-breakdown');

        // Format currency using browser's Intl API (defaults to USD if locale unknown)
        var currencyFormatter = new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: getCurrencyCode(),
            minimumFractionDigits: 2
        });

        updatePriceDisplay();

        // Attach change/input listeners to all relevant fields
        if (serviceField) {
            serviceField.addEventListener('change', updatePriceDisplay);
            serviceField.addEventListener('input', updatePriceDisplay);
        }
        if (hoursField) {
            hoursField.addEventListener('change', updatePriceDisplay);
            hoursField.addEventListener('input', updatePriceDisplay);
        }
        addonFields.forEach(function (addon) {
            addon.addEventListener('change', updatePriceDisplay);
        });

        /**
         * Reads field values, recalculates total, and renders display.
         */
        function updatePriceDisplay() {
            var breakdown = calculatePriceBreakdown();

            if (totalOutput) {
                totalOutput.textContent = currencyFormatter.format(breakdown.total);
            }

            if (breakdownOutput) {
                renderPriceBreakdown(breakdown, breakdownOutput, currencyFormatter);
            }
        }

        /**
         * Calculates the price breakdown object from form values.
         * @returns {{serviceName: string, baseRate: number, hours: number, addons: Array<{name:string, price:number}>, subtotal: number, total: number}}
         */
        function calculatePriceBreakdown() {
            var baseRate = 0;
            var serviceName = 'Service';
            var hours = 1;
            var addons = [];

            // Service type: can be a <select> with data-price on options or JSON in value
            if (serviceField) {
                if (serviceField.tagName.toLowerCase() === 'select') {
                    var selectedOption = serviceField.options[serviceField.selectedIndex];
                    if (selectedOption) {
                        serviceName = selectedOption.textContent.trim() || serviceName;
                        baseRate = parsePrice(selectedOption.getAttribute('data-price'));
                        if (!baseRate) baseRate = parsePrice(selectedOption.value);
                    }
                } else if (serviceField.type === 'radio') {
                    var radioGroup = document.querySelectorAll('input[name="' + serviceField.name + '"]');
                    radioGroup.forEach(function (r) {
                        if (r.checked) {
                            serviceName = (r.closest('label')?.textContent || r.value).trim();
                            baseRate = parsePrice(r.getAttribute('data-price') || r.value);
                        }
                    });
                } else {
                    serviceName = serviceField.value || serviceName;
                    baseRate = parsePrice(serviceField.getAttribute('data-price') || serviceField.value);
                }
            }

            // Number of hours
            if (hoursField) {
                var parsedHours = parseFloat(hoursField.value);
                if (!isNaN(parsedHours) && parsedHours > 0) {
                    hours = parsedHours;
                }
            }

            // Add-ons
            addonFields.forEach(function (addon) {
                if (addon.type === 'checkbox' ? addon.checked : (addon.type === 'radio' ? addon.checked : true)) {
                    var addonPrice = parsePrice(addon.getAttribute('data-booking-addon') || addon.getAttribute('data-price'));
                    var addonName = (addon.closest('label')?.textContent || addon.value || 'Add-on').trim();
                    if (addonPrice > 0) {
                        addons.push({ name: addonName, price: addonPrice });
                    }
                }
            });

            var serviceCost = baseRate * hours;
            var addonsTotal = addons.reduce(function (sum, a) { return sum + a.price; }, 0);
            var subtotal = serviceCost + addonsTotal;
            var total = subtotal;

            return {
                serviceName: serviceName,
                baseRate: baseRate,
                hours: hours,
                serviceCost: serviceCost,
                addons: addons,
                addonsTotal: addonsTotal,
                subtotal: subtotal,
                total: total
            };
        }

        /**
         * Builds and inserts an HTML breakdown of price components.
         */
        function renderPriceBreakdown(breakdown, container, formatter) {
            var rows = [];

            rows.push('<div class="price-row price-service"><span>' + escapeHtml(breakdown.serviceName) + ' (× ' + breakdown.hours + ' hr)</span><span>' + formatter.format(breakdown.serviceCost) + '</span></div>');

            breakdown.addons.forEach(function (addon) {
                rows.push('<div class="price-row price-addon"><span>' + escapeHtml(addon.name) + '</span><span>' + formatter.format(addon.price) + '</span></div>');
            });

            rows.push('<hr/>');
            rows.push('<div class="price-row price-total"><strong>Total</strong><strong>' + formatter.format(breakdown.total) + '</strong></div>');

            container.innerHTML = rows.join('\n');
        }

        /**
         * Attempts to parse a price number from a string or JSON value.
         * @param {string|number|null} val
         * @returns {number} Parsed numeric price or 0
         */
        function parsePrice(val) {
            if (!val) return 0;
            if (typeof val === 'number') return isNaN(val) ? 0 : val;

            // Try JSON first (e.g. option value is {"price":50})
            if (val.trim().charAt(0) === '{') {
                try {
                    var parsed = JSON.parse(val);
                    if (parsed.price != null) return Number(parsed.price) || 0;
                } catch (e) { /* fall through */ }
            }

            // Extract the first numeric value from the string (handles "$50", "50.00 USD", etc.)
            var numeric = val.match(/[-+]?\d*\.?\d+/);
            return numeric ? Number(numeric[0]) : 0;
        }

        /**
         * Detects currency code from document or falls back to USD.
         */
        function getCurrencyCode() {
            var meta = document.querySelector('meta[name="currency"]');
            if (meta) return meta.getAttribute('content') || 'USD';
            return 'USD';
        }
    }

    // ============================================================
    // Utility Helpers
    // ============================================================

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
