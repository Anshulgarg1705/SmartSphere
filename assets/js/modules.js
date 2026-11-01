
(function () {
    "use strict";

    var STORAGE_KEY = "smartsphereAttendance";

    var demoStudents = {
        "10-A": [
            { id: "STU1001", name: "Rahul Sharma" },
            { id: "STU1002", name: "Priya Singh" },
            { id: "STU1003", name: "Arjun Kumar" },
            { id: "STU1004", name: "Neha Gupta" },
            { id: "STU1005", name: "Rohit Verma" }
        ],
        "10-B": [
            { id: "STU1006", name: "Aman Kumar" },
            { id: "STU1007", name: "Sneha Sharma" },
            { id: "STU1008", name: "Karan Singh" },
            { id: "STU1009", name: "Anjali Verma" }
        ],
        "9-A": [
            { id: "STU1010", name: "Vikas Kumar" },
            { id: "STU1011", name: "Pooja Sharma" },
            { id: "STU1012", name: "Mohit Singh" },
            { id: "STU1013", name: "Simran Kaur" }
        ],
        "9-B": [
            { id: "STU1014", name: "Deepak Sharma" },
            { id: "STU1015", name: "Riya Gupta" },
            { id: "STU1016", name: "Harsh Verma" },
            { id: "STU1017", name: "Nisha Singh" }
        ]
    };

    function getElement(id) {
        return document.getElementById(id);
    }

    function readAttendance() {
        try {
            var records = JSON.parse(
                localStorage.getItem(STORAGE_KEY) || "[]"
            );

            return Array.isArray(records) ? records : [];
        } catch (error) {
            console.error("Attendance storage error:", error);
            return [];
        }
    }

    function initializeAttendance() {
        var classSelect = getElement("classSelect");
        var dateInput = getElement("attendanceDate");
        var tableBody = getElement("attendanceTableBody");
        var historyBody = getElement("attendanceHistoryBody");

        if (!classSelect || !dateInput || !tableBody || !historyBody) {
            return;
        }

        var attendance = readAttendance();
        var currentStudents = [];
        var currentStatuses = {};

        function getSelectedClass() {
            return classSelect.value;
        }

        function getSelectedDate() {
            return dateInput.value;
        }

        function getRecord(className, date) {
            return attendance.find(function (record) {
                return record.className === className &&
                    record.date === date;
            });
        }

        function updateStats() {
            var total = currentStudents.length;
            var present = 0;
            var absent = 0;

            currentStudents.forEach(function (student) {
                if (currentStatuses[student.id] === "Present") {
                    present++;
                } else if (currentStatuses[student.id] === "Absent") {
                    absent++;
                }
            });

            getElement("totalStudents").textContent = total;
            getElement("presentCount").textContent = present;
            getElement("absentCount").textContent = absent;

            var percentage = total
                ? Math.round((present / total) * 100)
                : 0;

            getElement("attendanceRate").textContent = percentage + "%";
        }

        function renderStudents() {
            tableBody.innerHTML = "";

            currentStudents.forEach(function (student) {
                var row = document.createElement("tr");

                var nameCell = document.createElement("td");
                var studentWrapper = document.createElement("div");
                var avatar = document.createElement("div");
                var name = document.createElement("strong");

                var initials = student.name.split(/\s+/)
                    .slice(0, 2)
                    .map(function (part) {
                        return part.charAt(0);
                    })
                    .join("")
                    .toUpperCase();

                studentWrapper.className = "attendance-student";
                avatar.className = "attendance-student-avatar";
                avatar.textContent = initials;
                name.textContent = student.name;

                studentWrapper.appendChild(avatar);
                studentWrapper.appendChild(name);
                nameCell.appendChild(studentWrapper);

                var idCell = document.createElement("td");
                idCell.textContent = student.id;

                var statusCell = document.createElement("td");
                var choices = document.createElement("div");

                choices.className = "attendance-choice";

                var presentButton = document.createElement("button");
                presentButton.type = "button";
                presentButton.textContent = "Present";

                var absentButton = document.createElement("button");
                absentButton.type = "button";
                absentButton.textContent = "Absent";

                function updateButtons() {
                    presentButton.className =
                        currentStatuses[student.id] === "Present"
                            ? "present-selected"
                            : "";

                    absentButton.className =
                        currentStatuses[student.id] === "Absent"
                            ? "absent-selected"
                            : "";
                }

                presentButton.addEventListener("click", function () {
                    currentStatuses[student.id] = "Present";
                    updateButtons();
                    updateStats();
                    markUnsaved();
                });

                absentButton.addEventListener("click", function () {
                    currentStatuses[student.id] = "Absent";
                    updateButtons();
                    updateStats();
                    markUnsaved();
                });

                choices.appendChild(presentButton);
                choices.appendChild(absentButton);
                statusCell.appendChild(choices);

                row.appendChild(nameCell);
                row.appendChild(idCell);
                row.appendChild(statusCell);

                tableBody.appendChild(row);

                updateButtons();
            });

            updateStats();
        }

        function markUnsaved() {
            getElement("attendanceMessage").textContent =
                "You have unsaved attendance changes.";
        }

        function loadAttendance() {
            var className = getSelectedClass();
            var date = getSelectedDate();

            if (!date) {
                alert("Please select an attendance date.");
                return;
            }

            currentStudents = demoStudents[className] || [];
            currentStatuses = {};

            var savedRecord = getRecord(className, date);

            if (savedRecord && Array.isArray(savedRecord.students)) {
                savedRecord.students.forEach(function (student) {
                    currentStatuses[student.id] = student.status;
                });
            }

            getElement("selectedClassHeading").textContent =
                "Class " + className.replace("-", " - ");

            getElement("attendanceStatusText").textContent =
                savedRecord
                    ? "Previously saved attendance loaded."
                    : "Mark attendance for the selected date.";

            getElement("attendanceMessage").textContent =
                savedRecord
                    ? "Saved attendance loaded successfully."
                    : "Changes are not saved yet.";

            renderStudents();
        }

        function saveCurrentAttendance() {
            var className = getSelectedClass();
            var date = getSelectedDate();

            if (!date) {
                alert("Please select a date.");
                return;
            }

            var incomplete = currentStudents.some(function (student) {
                return !currentStatuses[student.id];
            });

            if (incomplete) {
                alert("Please mark every student as Present or Absent.");
                return;
            }

            var recordStudents = currentStudents.map(function (student) {
                return {
                    id: student.id,
                    name: student.name,
                    status: currentStatuses[student.id]
                };
            });

            var record = {
                className: className,
                date: date,
                students: recordStudents,
                total: recordStudents.length,
                present: recordStudents.filter(function (student) {
                    return student.status === "Present";
                }).length,
                absent: recordStudents.filter(function (student) {
                    return student.status === "Absent";
                }).length
            };

            var existingIndex = attendance.findIndex(function (item) {
                return item.className === className && item.date === date;
            });

            if (existingIndex >= 0) {
                attendance[existingIndex] = record;
            } else {
                attendance.push(record);
            }

            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(attendance));
            } catch (error) {
                console.error("Attendance save error:", error);
                alert("Unable to save attendance. Please check browser storage.");
                return;
            }

            getElement("attendanceMessage").textContent =
                "Attendance saved successfully.";

            getElement("attendanceStatusText").textContent =
                "Attendance has been saved.";

            renderHistory();

            alert("Attendance saved successfully.");
        }

        function renderHistory() {
            historyBody.innerHTML = "";

            if (attendance.length === 0) {
                var emptyRow = document.createElement("tr");
                var emptyCell = document.createElement("td");

                emptyCell.colSpan = 6;
                emptyCell.className = "empty-table-message";
                emptyCell.textContent = "No attendance records saved yet.";

                emptyRow.appendChild(emptyCell);
                historyBody.appendChild(emptyRow);
                return;
            }

            var sortedRecords = attendance.slice().sort(function (a, b) {
                return b.date.localeCompare(a.date);
            });

            sortedRecords.forEach(function (record) {
                var row = document.createElement("tr");

                var percentage = record.total
                    ? Math.round((record.present / record.total) * 100)
                    : 0;

                [
                    record.date,
                    "Class " + record.className.replace("-", " - "),
                    record.total,
                    record.present,
                    record.absent,
                    percentage + "%"
                ].forEach(function (value) {
                    var cell = document.createElement("td");
                    cell.textContent = value;
                    row.appendChild(cell);
                });

                historyBody.appendChild(row);
            });
        }

        getElement("loadAttendanceBtn").addEventListener(
            "click",
            loadAttendance
        );

        getElement("markAllPresent").addEventListener("click", function () {
            currentStudents.forEach(function (student) {
                currentStatuses[student.id] = "Present";
            });

            renderStudents();
            markUnsaved();
        });

        getElement("markAllAbsent").addEventListener("click", function () {
            currentStudents.forEach(function (student) {
                currentStatuses[student.id] = "Absent";
            });

            renderStudents();
            markUnsaved();
        });

        getElement("saveAttendanceBtn").addEventListener(
            "click",
            saveCurrentAttendance
        );

        classSelect.addEventListener("change", loadAttendance);
        dateInput.addEventListener("change", loadAttendance);

        var today = new Date();
        var localDate = new Date(
            today.getTime() - today.getTimezoneOffset() * 60000
        ).toISOString().slice(0, 10);

        dateInput.value = localDate;
        dateInput.max = localDate;

        try {
            var user = JSON.parse(
                localStorage.getItem("smartsphereUser") || "null"
            );

            if (user) {
                var name = user.name || "User";
                var role = user.role || "User";

                getElement("moduleUserName").textContent = name;
                getElement("moduleUserRole").textContent = role;

                getElement("moduleAvatar").textContent =
                    name.trim().split(/\s+/).slice(0, 2)
                    .map(function (part) {
                        return part.charAt(0);
                    })
                    .join("")
                    .toUpperCase();

                if (String(role).toLowerCase() === "teacher") {
                    getElement("dashboardLink").href = "teacher.html";
                }
            }
        } catch (error) {
            console.error("User session error:", error);
        }

        getElement("moduleLogout").addEventListener("click", function () {
            localStorage.removeItem("smartsphereUser");
            window.location.href = "index.html";
        });

        getElement("currentDate").textContent =
            today.toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric"
            });

        renderHistory();
        loadAttendance();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initializeAttendance);
    } else {
        initializeAttendance();
    }
})();
