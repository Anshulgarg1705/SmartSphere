// Check teacher login session
const currentUser = JSON.parse(
    localStorage.getItem("smartsphereUser")
);

// Only teachers can access this dashboard
if (!currentUser || currentUser.role !== "teacher") {
    window.location.href = "index.html";
} else {

    // Display teacher's name
    document.getElementById("teacherName").textContent =
        currentUser.name;

    document.getElementById("sidebarTeacherName").textContent =
        currentUser.name;

    document.getElementById("profileTeacherName").textContent =
        currentUser.name;

    document.getElementById("profileTeacherEmail").textContent =
        currentUser.email;

    // Generate initials
    const initials = currentUser.name
        .split(" ")
        .map(word => word[0])
        .join("")
        .substring(0, 2)
        .toUpperCase();

    document.getElementById("teacherAvatar").textContent = initials;
    document.getElementById("topTeacherAvatar").textContent = initials;

    // Display current date
    const today = new Date();

    document.getElementById("currentDate").textContent =
        today.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric"
        });
}

// Logout functionality
const logoutButton = document.getElementById("logoutBtn");

if (logoutButton) {
    logoutButton.addEventListener("click", function () {
        localStorage.removeItem("smartsphereUser");
        window.location.href = "index.html";
    });
}