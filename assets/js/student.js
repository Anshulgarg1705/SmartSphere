
// Check student login session

const currentUser = JSON.parse(
    localStorage.getItem("smartsphereUser")
);

if (!currentUser || currentUser.role !== "student") {
    window.location.href = "index.html";
}

// Display logged-in student's name

if (currentUser) {

    const studentName = currentUser.name;

    document.getElementById("welcomeName").textContent =
        `Hello, ${studentName}! 👋`;

    document.getElementById("topStudentName").textContent =
        studentName;

    // Generate initials for profile avatar

    const initials = studentName
        .split(" ")
        .map(word => word[0])
        .join("")
        .substring(0, 2)
        .toUpperCase();

    document.querySelector(".avatar").textContent = initials;
}

// Logout functionality

document.getElementById("logoutBtn").addEventListener(
    "click",
    function() {

        localStorage.removeItem("smartsphereUser");

        window.location.href = "index.html";

    }
);
