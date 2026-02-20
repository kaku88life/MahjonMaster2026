document.addEventListener('DOMContentLoaded', () => {
    // 1. Animate Progress Bars on Scroll
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate');
                // Trigger circle animation if present
                const circles = entry.target.querySelectorAll('.circle');
                circles.forEach(c => {
                    // Logic to reset animation or similar if needed
                    // CSS animation handles it mostly, but we can force redraw
                    c.style.animation = 'none';
                    c.offsetHeight; /* trigger reflow */
                    c.style.animation = 'progress 1s ease-out forwards';
                });
            }
        });
    });

    const progressSection = document.querySelector('.progress-section');
    if (progressSection) observer.observe(progressSection);

    // 2. Simple Testimonial Rotator (Optional)
    const testimonials = [
        { text: "The claymorphism design makes learning feel like playing a game. I love it!", name: "Jessica M.", color: "#a18cd1" },
        { text: "I finished my first coding course in 3 days. So addictive!", name: "Alex T.", color: "#84fab0" },
        { text: "Best platform for visual learners. Highly recommended.", name: "Sarah L.", color: "#ff9a9e" }
    ];

    let currentTestimonial = 0;
    const testimonialCard = document.querySelector('.testimonial-card');

    // Auto rotate every 5 seconds
    setInterval(() => {
        currentTestimonial = (currentTestimonial + 1) % testimonials.length;
        const data = testimonials[currentTestimonial];

        // Simple fade out/in effect
        testimonialCard.style.opacity = 0;

        setTimeout(() => {
            testimonialCard.querySelector('p').textContent = `"${data.text}"`;
            testimonialCard.querySelector('span').textContent = data.name;
            testimonialCard.querySelector('.user-avatar').style.background = data.color;
            testimonialCard.querySelector('.user-avatar').textContent = data.name[0];
            testimonialCard.style.opacity = 1;
        }, 300);
    }, 5000);

    // 3. Floating Shape Interactive Parallax
    document.addEventListener('mousemove', (e) => {
        const wrappers = document.querySelectorAll('.parallax-wrapper');
        const x = (e.clientX / window.innerWidth) - 0.5;
        const y = (e.clientY / window.innerHeight) - 0.5;

        wrappers.forEach((wrapper) => {
            const speed = parseFloat(wrapper.getAttribute('data-speed')) * 30;
            const xOffset = x * speed;
            const yOffset = y * speed;
            wrapper.style.transform = `translate(${xOffset}px, ${yOffset}px)`;
        });
    });
});
