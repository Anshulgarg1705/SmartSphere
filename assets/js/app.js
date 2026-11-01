
const demoUsers = {
    student: {
        email: "student@campus.com",
        password: "stud123",
        name: "Rahul Sharma",
        dashboard: "student.html"
    },

    teacher: {
        email: "teacher@campus.com",
        password: "teach123",
        name: "Mr. Amit Verma",
        dashboard: "teacher.html"
    },

    admin: {
        email: "admin@campus.com",
        password: "admin123",
        name: "Administrator",
        dashboard: "admin.html"
    }
};

const loginForm = document.getElementById("loginForm");

if (loginForm) {

    loginForm.addEventListener("submit", function(event) {

        event.preventDefault();

        const role = document.getElementById("role").value;
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const errorMessage = document.getElementById("errorMessage");

        const user = demoUsers[role];

        if (
            user &&
            email === user.email &&
            password === user.password
        ) {

            const session = {
                role: role,
                name: user.name,
                email: user.email
            };

            localStorage.setItem(
                "smartsphereUser",
                JSON.stringify(session)
            );

            window.location.href = user.dashboard;

        } else {

            errorMessage.textContent =
                "Invalid credentials! Please check your login details.";

        }

    });

}
