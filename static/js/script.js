////////////////////////////////////////// Filter and Settings //////////////////////////////////////////
document.getElementById('resetFilters').addEventListener('click', function (event) {

    document.getElementById('minRating').value = 0;
    document.getElementById('maxRating').value = 5;
    document.getElementById('minRuntime').value = 0;
    document.getElementById('maxRuntime').value = 9999;
    document.getElementById('minYear').value = 1870;
    document.getElementById('maxYear').value = 2025;
});

document.getElementById('applyFilters').addEventListener('click', async function (event) {

    const compareButton = document.getElementById('compareButton');
    if (!compareButton.disabled) {
        const event = new Event('click', { bubbles: true });
        event.refresh = -1;
        compareButton.dispatchEvent(event);
    }
});




// Listen for the form submit event
document.getElementById('usernameForm').addEventListener('submit', function (event) {
    event.preventDefault();

    fetchUserData(document.getElementById('inputUsername').value);
    document.getElementById('inputUsername').placeholder ='Username';  
    document.getElementById('inputUsername').value = "";
});

// global list of all users
let allUsers = [];
// To track whether all users have been fetched
let num_users_done = 0;
let num_users_total = 0;

////////////////////////////////////////// Fetch User Data //////////////////////////////////////////
async function fetchUserData(username) {
    try {
        // Fetch the initial user info
        const response = await fetch(`/get_user/${username}`);
        if (!response.ok) throw new Error("User not found");
        const data = await response.json();
        const current_user = data.current_user;
        
        document.getElementById('compareButton').disabled = true;

        allUsers = data.all_users;
        console.log(allUsers);
        num_users_total = data.total_users;

        // Create a new column with the basic info and a loading spinner inside
        const col = document.createElement("div");
        col.className = "col-md-3 mb-4";
        col.id = `user-${username}`;
        col.innerHTML = `
            <div class="card user-card text-center h-100 d-flex flex-column justify-content-between position-relative">
                <button 
                    type="button"
                    class="btn-close position-absolute top-0 end-0 m-2 close-btn user-close-btn" 
                    aria-label="Close"
                    data-username="${username}">
                </button>
                <div>
                    <img src="${current_user.avatar}" class="img-fluid rounded-circle mt-3 mx-auto" style="width: 100px; height: 100px;" alt="${current_user.name}'s avatar">
                    <div class="card-body">
                        <h5 class="card-title">${current_user.name}</h5>
                        <p id="user-stats-${username}" class="card-text text-muted">Fetching user data...</p>
                        <a href="${current_user.url}" target="_blank" class="btn btn-outline-secondary btn-sm">View Profile</a>
                    </div>
                </div>
                <div class="pb-3">
                    <div class="spinner-border text-secondary" role="status" id="spinner-${username}">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                </div>
            </div>
        `;
        document.getElementById("userRow").appendChild(col);

        // Add event listener for the close button
        col.querySelector('.close-btn').addEventListener('click', (e) => {
            const usernameToRemove = e.target.getAttribute('data-username');
            // Call your custom logic here
            console.log(`Close button clicked for user: ${usernameToRemove}`);

            // Example: Remove the card
            const cardToRemove = document.getElementById(`user-${usernameToRemove}`);
            if (cardToRemove) {
                cardToRemove.remove();
                // Delete user from allUsers
                allUsers = allUsers.filter(user => user.username !== usernameToRemove);
                console.log(`User ${usernameToRemove} removed from allUsers.`);
                // Update the number of users done
                num_users_done -= 1;
                // Enable the compare button if no users are left
                if (num_users_done <= 1) {
                    document.getElementById('compareButton').disabled = true;
                }
                else {
                    // press the compare button to update the recommendations
                    const event = new Event('click', { bubbles: true });
                    event.refresh = 1;
                    document.getElementById('compareButton').dispatchEvent(event);
                }
            }
        });

        // Now fetch the more in-depth user data, such as watchlist and ratings
        const response2 = await fetch(`/get_user_data/${username}`);
        if (!response2.ok) throw new Error("Could not fetch user data");
        const data2 = await response2.json();
        console.log(data2);

        // Update stats text
        const statsEl = document.getElementById(`user-stats-${username}`);
        // statsEl.style.whiteSpace = "pre-line";
        statsEl.textContent = `Watched: ${current_user.num_movies_watched} | Watchlist: ${current_user.watchlist_length}`;

        // Remove spinner
        const spinner = document.getElementById(`spinner-${username}`);
        if (spinner) spinner.remove();

        // Mark this user as done and check whether any other is still loading
        num_users_done += 1;
        if (num_users_total > 1) {
            if (num_users_done === num_users_total) {
                document.getElementById('compareButton').disabled = false;
            }
        }

    } catch (error) {
        // TODO: Handle not found and max exceeded separately
        console.error(error);
        document.getElementById("enterUsernameHeader").textContent = "User not found. Try Again:";
    }
}


async function InitializeAndTrain() {
    try {
        usernames = allUsers.map(user => user.username);
        const userParam = usernames.join(",");

        const response = await fetch(`/preprocess_data/${userParam}`);
        if (!response.ok) throw new Error("Something went wrong preprocessing data");

        const response2 = await fetch(`/train_model`);
        if (!response2.ok) throw new Error("Something went wrong training model");

    } catch (error) {
        console.error(error);
    }
}

////////////////////////////////////////// Fetch Content Data //////////////////////////////////////////
async function FetchCommonWatchlist(minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear) {
    try {
        const usernames = allUsers.map(u => u.username).join(",");
        const response = await fetch(`/fetch_common_watchlist/${usernames}/${minRating}/${maxRating}/${minRuntime}/${maxRuntime}/${minYear}/${maxYear}`);
        if (!response.ok) throw new Error("Something went wrong getting common watchlist");
        const data = await response.json();

        const realContent = document.getElementById("realContent");
        // delete all existing cards
        while (realContent.firstChild) {
            realContent.removeChild(realContent.firstChild);
        }

        document.getElementById("commonWatchlistCount").textContent = data.length;

        // Loop through the data and generate the cards
        data.forEach(movie => {

            // Generate each card
            const card = document.createElement("div");
            card.classList.add("col");
            card.innerHTML = `
                <img src="${movie.poster}" 
                    class="card-img-top rounded open-movie-modal" 
                    alt="${`${movie.title}`}"
                    slug="${movie.slug}">
            `;
            realContent.appendChild(card);
        });

    } catch (error) {
        console.error(error);
    }
    
}

// Fetch single watchlist from Flask backend and populate the DOM
async function FetchSingleWatchlist(minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear) {
    try {

        const all_usernames = allUsers.map(u => u.username).join(",");

        const superContainer = document.getElementById("SingleWatchlistsContainer");
        // delete all existing containers
        while (superContainer.firstChild) {
            superContainer.removeChild(superContainer.firstChild);
        }

        let index = 0
        for (let user of allUsers) {

            index = index+1;

            const containerId = `SingleWatchlistContainer_${user.username}`;
            const titleId = `SWL_${user.username}_title`;
            const subtitleId = `SWL_${user.username}_subtitle`;
            const contentId = `SWC_${user.username}_RC`;
        
            const isEven = index % 2 === 0;

            // Remove the old container if it exists
            const oldContainer = document.getElementById(containerId);
            if (oldContainer) {
                oldContainer.remove();
            }
        
            const container = document.createElement('div');
            if (index == 1) {
                container.className = "container hover-zoom bg-tertiary-subtle w-75 p-3";
            } else {
                container.className = "container mt-4 hover-zoom bg-tertiary-subtle w-75 p-3";
            }
            container.id = containerId;
        
            container.innerHTML = `
                <div class="row justify-content-evenly align-items-center" data-aos="${isEven ? 'fade-left' : 'fade-right'}">
                    <div class="col-md-3 justify-content-center align-items-center ${isEven ? '' : 'order-md-2'}">
                        <h1 id="${titleId}" style="margin-bottom: 0px;" class="text-center">${user.name}'s</h1>
                        <h1 class="text-center">Watchlist</h1>
                        <p id="${subtitleId}" class="text-center text-muted">Movies the other(s) might like!</p>
                    </div>
                    <div class="col-md-8 justify-content-center align-items-center ${isEven ? '' : 'order-md-1'}">
                        <div class="row row-cols-1 row-cols-md-5 g-4" id="${contentId}"></div>
                    </div>
                </div>
            `;

            superContainer.appendChild(container);


            const response = await fetch(`/fetch_single_watchlist/${user.username}/${all_usernames}/${minRating}/${maxRating}/${minRuntime}/${maxRuntime}/${minYear}/${maxYear}`);
            if (!response.ok) throw new Error(`Something went wrong getting single watchlist ${SWL_num}`);
            const data = await response.json();

            // Loop through the data and generate the cards
            data.forEach(movie => {

                // Generate each card
                const card = document.createElement("div");
                card.classList.add("col");
                card.innerHTML = `
                    <img src="${movie.poster}" 
                        class="card-img-top rounded open-movie-modal" 
                        alt="${`${movie.title}`}"
                        slug="${movie.slug}">
                `;
                document.getElementById(`${contentId}`).appendChild(card);
            });
        
            

        }

    } catch (error) {
        console.error(error);
    }
    
}

// Fetch single watchlist from Flask backend and populate the DOM
async function FetchSingleWatchlistOLD(username1, username2, SWL_num, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear) {
    try {
        const response = await fetch(`/fetch_single_watchlist/${username1}/${username2}/${minRating}/${maxRating}/${minRuntime}/${maxRuntime}/${minYear}/${maxYear}`);
        if (!response.ok) throw new Error(`Something went wrong getting single watchlist ${SWL_num}`);
        const data = await response.json();

        const realContent = document.getElementById(`SWC${SWL_num}_RC`);
        // delete all existing cards
        while (realContent.firstChild) {
            realContent.removeChild(realContent.firstChild);
        }

        // Loop through the data and generate the cards
        data.forEach(movie => {

            // Generate each card
            const card = document.createElement("div");
            card.classList.add("col");
            card.innerHTML = `
                <img src="${movie.poster}" 
                    class="card-img-top rounded open-movie-modal" 
                    alt="${`${movie.title}`}"
                    slug="${movie.slug}">
            `;
            realContent.appendChild(card);
        });

    } catch (error) {
        console.error(error);
    }
    
}

// Fetch common watchlist from Flask backend and populate the DOM
async function FetchRewatchlist(username, other_usernames, realRewatchCombo, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear) {
    try {
        const response = await fetch(`/fetch_rewatchlist/${username}/${other_usernames}/${minRating}/${maxRating}/${minRuntime}/${maxRuntime}/${minYear}/${maxYear}`);
        if (!response.ok) throw new Error("Something went wrong getting rewatchlist");
        const data = await response.json();
        
        // delete all existing carousel items
        while (realRewatchCombo.firstChild) {
            realRewatchCombo.removeChild(realRewatchCombo.firstChild);
        }

        // Loop through the data and generate the carousel items
        index = 0;
        data.forEach(movie => {

            index += 1;

            // Generate each carousel item
            realRewatchCombo.innerHTML += `
            <div class="carousel-item ${index === 1 ? 'active' : ''}">
                <div class="hover-zoom overflow-hidden">
                    <img src="${movie.banner}" class="d-block w-100 rounded open-movie-modal" alt="${movie.title}" slug="${movie.slug}">
                </div>
                <div class="position-relative text-center text-muted p-3" style="font-size: 18px;">
                    ${movie.title} (${movie.year})
                </div>
            </div>
            `;
        });

    } catch (error) {
        console.error(error);
    }
    
}

async function generateRewatchCarousels(allUsers, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear) {
    const container = document.getElementById("RewatchContainer");
    container.innerHTML = ""; // Clear previous carousels

    for (let user of allUsers) {
        const otherUsers = allUsers.filter(u => u.username !== user.username);
        const otherUsernames = otherUsers.map(u => u.username).join(",");

        const carouselId = `carousel-${user.username}`;
        const carouselInnerId = `${carouselId}-inner`;

        // Create carousel HTML dynamically
        // TODO: Can also do: <div class="d-inline-block align-top" style="width: 500px; margin-right: 20px;"> in first line!
        container.innerHTML += `
            <div class="col-md-6 d-inline-block align-top">
                <h1 class="text-center">Rewatches for ${user.name}</h1>
                <p class="text-center text-muted mb-3">Movies highly rated by ${user.name} that the other(s) might like!</p>
                <div id="${carouselId}" class="carousel slide p-4" data-bs-ride="carousel">
                    <div class="carousel-inner" id="${carouselInnerId}"></div>
                    <button class="carousel-control-prev" type="button" data-bs-target="#${carouselId}" data-bs-slide="prev">
                        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="white" viewBox="0 0 16 16">
                            <path d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"/>
                        </svg>
                    </button>
                    <button class="carousel-control-next" type="button" data-bs-target="#${carouselId}" data-bs-slide="next">
                        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="white" viewBox="0 0 16 16">
                            <path d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;

        // Fetch and populate carousel
        const innerCarousel = document.getElementById(carouselInnerId);
        await FetchRewatchlist(user.username, otherUsernames, innerCarousel, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear);
    }
}







// Function to handle explanation logic
async function explainMovie(slug, title, year) {

    usernames = getActiveUsernames();
    console.log(`Explain movie with slug ${slug} for users: ${usernames}`);

    let description = "";

    for (const username of usernames) {
        let response = await fetch(`/fetch_explanation/${username}/${slug}`);
        if (!response.ok) throw new Error("Something went wrong getting explanation");
        let data = await response.json();
        if (data.success){
            explainModalTitle.textContent = `We recommend ${title} (${year})`;
            description += `<h6>Since ${username} likes:</h6>`;
            description += "<ul>";
            for (let movie of data.movies) {
                description += `<li>${movie.title} (${movie.year})</li>`;
            }
            description += "</ul>";
        }
    }

    // Set the modal text using innerHTML to preserve formatting
    explainModalText.innerHTML = description;

    // Show the modal
    let modal = new bootstrap.Modal(document.getElementById("explainModal"));
    modal.show();

}

// Function to handle blacklist logic
async function blacklistMovie(slug, title, year, weight) {
    weight = parseInt(weight, 10);

    document.getElementById("blacklistModalTitle").textContent = `Add ${title} (${year}) To Blacklist`;
    document.getElementById("blacklistModalText").innerHTML = `For which user would you like to add <b>${title} (${year})</b> to the blacklist?`;
    document.getElementById("user1BlacklistCheckboxText").textContent = allUsers[0].name;
    document.getElementById("user2BlacklistCheckboxText").textContent = allUsers[1].name;

    // Get elements
    let user1Checkbox = document.getElementById("user1BlacklistCheckbox");
    let user2Checkbox = document.getElementById("user2BlacklistCheckbox");
    let addToBlacklistBtn = document.getElementById("addToBlacklistBtn");
    let loadingIndicator = document.getElementById("blacklistLoading");

    if (!user1Checkbox || !user2Checkbox || !loadingIndicator) {
        console.error("Required elements not found!");
        return;
    }

    // Reset checkboxes and button state
    user1Checkbox.checked = false;
    user2Checkbox.checked = false;
    addToBlacklistBtn.disabled = true; // Initially disable button
    loadingIndicator.style.display = "none"; // Hide loading initially

    // Apply logic for weight
    if (weight === -1) {
        user1Checkbox.checked = true;
        addToBlacklistBtn.disabled = false;
    } else if (weight === 1) {
        user2Checkbox.checked = true;
        addToBlacklistBtn.disabled = false;
    } else if (weight === 0) {
        addToBlacklistBtn.disabled = true;
    }

    // Function to enable/disable button based on checkbox selection
    function updateButtonState() {
        addToBlacklistBtn.disabled = !(user1Checkbox.checked || user2Checkbox.checked);
    }

    // Add event listeners to checkboxes
    user1Checkbox.addEventListener("change", updateButtonState);
    user2Checkbox.addEventListener("change", updateButtonState);

    // Show the modal
    let modal = new bootstrap.Modal(document.getElementById("blacklistModal"));
    modal.show();

    // Add click event to blacklist button
    document.getElementById("addToBlacklistBtn").onclick = async function () {
        let selectedUsers = [];

        if (user1Checkbox.checked) selectedUsers.push(allUsers[0].username);
        if (user2Checkbox.checked) selectedUsers.push(allUsers[1].username);

        // Show loading spinner and disable button
        addToBlacklistBtn.disabled = true;
        addToBlacklistBtn.textContent = "Processing...";
        loadingIndicator.style.display = "block"; 

        try {
            for (let user of selectedUsers) {
                let response = await fetch(`/add_to_blacklist/${user}/${slug}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" }
                });
                if (!response.ok) {
                    throw new Error(`Failed to add ${slug} to ${user}'s blacklist`);
                }
            }

            // Function to wait for compare button action to complete
            async function waitForCompareUpdate() {
                return new Promise((resolve) => {
                    function onCompareComplete() {
                        console.log("Compare button action completed.");
                        resolve();
                    }

                    compareButton.addEventListener("compareComplete", onCompareComplete, { once: true });

                    const event = new Event("click", { bubbles: true });
                    event.refresh = 1;
                    compareButton.dispatchEvent(event);
                });
            }

            console.log("Waiting for compare button action...");
            await waitForCompareUpdate();
            console.log("Compare button action completed.");

            // Close modal
            modal.hide();

        } catch (error) {
            console.error(error);
            alert("Something went wrong. Please try again.");
        } finally {
            // Reset button and hide loading indicator
            addToBlacklistBtn.disabled = true; // Re-disable button after completion
            addToBlacklistBtn.textContent = "Add to Blacklist";
            loadingIndicator.style.display = "none";
        }
    };
}



document.getElementById("editBlacklistModal").addEventListener("show.bs.modal", async function () {
    const user1BlacklistMovies = document.getElementById("user1BlacklistMovies");
    const user2BlacklistMovies = document.getElementById("user2BlacklistMovies");

    document.getElementById("user1-tab").textContent = allUsers[0].name;
    document.getElementById("user2-tab").textContent = allUsers[1].name;

    // Clear previous entries before fetching
    user1BlacklistMovies.innerHTML = '<li class="list-group-item text-muted">Loading...</li>';
    user2BlacklistMovies.innerHTML = '<li class="list-group-item text-muted">Loading...</li>';
    document.getElementById("resetUser1Blacklist").style.display = "block";
    document.getElementById("resetUser2Blacklist").style.display = "block";

    try {
        // Fetch data from backend
        let response = await fetch("/fetch_blacklists/" + allUsers[0].username + "/" + allUsers[1].username);
        if (!response.ok) throw new Error("Failed to fetch blacklists");

        let data = await response.json(); // { user1: [...movies], user2: [...movies] }

        // Populate User 1 Blacklist
        user1BlacklistMovies.innerHTML = "";
        if (data.user1.length > 0) {
            data.user1.forEach(movie => {
                let li = document.createElement("li");
                li.className = "list-group-item d-flex justify-content-between align-items-center";
                li.innerHTML = `${movie.title} (${movie.year}) 
                    <button class="btn btn-sm btn-danger remove-movie" data-name="${allUsers[0]}" data-user="${allUsers[0].username}" data-movie="${movie.slug}">&#10005;</button>`;
                user1BlacklistMovies.appendChild(li);
            });
        } else {
            user1BlacklistMovies.innerHTML = '<li class="list-group-item text-muted">No blacklisted movies</li>';
            // hide clear button
            document.getElementById("resetUser1Blacklist").style.display = "none";
        }

        // Populate User 2 Blacklist
        user2BlacklistMovies.innerHTML = "";
        if (data.user2.length > 0) {
            data.user2.forEach(movie => {
                let li = document.createElement("li");
                li.className = "list-group-item d-flex justify-content-between align-items-center";
                li.innerHTML = `${movie.title} (${movie.year}) 
                    <button class="btn btn-sm btn-danger remove-movie" data-name="${allUsers[1].name}" data-user="${allUsers[1].username}" data-movie="${movie.slug}">&#10005;</button>`;
                user2BlacklistMovies.appendChild(li);
            });
        } else {
            user2BlacklistMovies.innerHTML = '<li class="list-group-item text-muted">No blacklisted movies</li>';
            // hide clear button
            document.getElementById("resetUser2Blacklist").style.display = "none";
        }

    } catch (error) {
        console.error(error);
        user1BlacklistMovies.innerHTML = '<li class="list-group-item text-danger">Error loading blacklist</li>';
        user2BlacklistMovies.innerHTML = '<li class="list-group-item text-danger">Error loading blacklist</li>';
    }
});


document.addEventListener("click", async function (event) {
    if (event.target.classList.contains("remove-movie")) {
        let user = event.target.dataset.user;
        let name = event.target.dataset.name;
        let movieSlug = event.target.dataset.movie;

        // if (!confirm(`Are you sure you want to remove this movie from ${name}'s blacklist?`)) {
        //     return;
        // }
        
        const loadingSpinner = document.getElementById("blacklistLoadingSpinner");
        // Show loading spinner and clear previous lists
        loadingSpinner.style.display = "block"; 

        try {
            let response = await fetch(`/remove_from_blacklist/${user}/${movieSlug}`, { method: "DELETE" });
            if (!response.ok) throw new Error("Failed to remove movie");

            // Refresh blacklist after removal
            document.getElementById("editBlacklistModal").dispatchEvent(new Event("show.bs.modal"));

            // Trigger compare button action to update recommendations
            // Function to wait for compare button action to complete
            async function waitForCompareUpdate() {
                return new Promise((resolve) => {
                    function onCompareComplete() {
                        console.log("Compare button action completed.");
                        resolve();
                    }

                    compareButton.addEventListener("compareComplete", onCompareComplete, { once: true });

                    const event = new Event("click", { bubbles: true });
                    event.refresh = 1;
                    compareButton.dispatchEvent(event);
                });
            }

            console.log("Waiting for compare button action...");
            await waitForCompareUpdate();
            console.log("Compare button action completed.");

        } catch (error) {
            console.error(error);
            alert("Something went wrong. Please try again.");
        }
        finally {
            // Hide loading spinner
            loadingSpinner.style.display = "none";
        }
    }


});

// Reset User 1 Blacklist
document.getElementById("resetUser1Blacklist").addEventListener("click", async function () {
    const user1BlacklistMovies = document.getElementById("user1BlacklistMovies");

    // Clear the list on the frontend
    user1BlacklistMovies.innerHTML = '<li class="list-group-item text-muted">No blacklisted movies</li>';
    // Remove clear button
    document.getElementById("resetUser1Blacklist").style.display = "none";

    const loadingSpinner = document.getElementById("blacklistLoadingSpinner");
    // Show loading spinner and clear previous lists
    loadingSpinner.style.display = "block"; 

    // API call to reset blacklist on the server for User 1
    try {
        let response = await fetch(`/reset_blacklist/${allUsers[0].username}`, { method: "DELETE" });
        if (!response.ok) throw new Error("Failed to reset User 1 blacklist");
        console.log("User 1 blacklist reset successfully");

        // Trigger compare button action to update recommendations
        // Function to wait for compare button action to complete
        async function waitForCompareUpdate() {
            return new Promise((resolve) => {
                function onCompareComplete() {
                    console.log("Compare button action completed.");
                    resolve();
                }

                compareButton.addEventListener("compareComplete", onCompareComplete, { once: true });

                const event = new Event("click", { bubbles: true });
                event.refresh = 1;
                compareButton.dispatchEvent(event);
            });
        }

        console.log("Waiting for compare button action...");
        await waitForCompareUpdate();
        console.log("Compare button action completed.");

    } catch (error) {
        console.error(error);
        alert("Error resetting User 1 blacklist");
    }
    finally {
        // Hide loading spinner
        loadingSpinner.style.display = "none";
    }
});

// Reset User 1 Blacklist
document.getElementById("resetUser2Blacklist").addEventListener("click", async function () {
    const user1BlacklistMovies = document.getElementById("user2BlacklistMovies");

    // Clear the list on the frontend
    user1BlacklistMovies.innerHTML = '<li class="list-group-item text-muted">No blacklisted movies</li>';
    // Remove clear button
    document.getElementById("resetUser2Blacklist").style.display = "none";

    const loadingSpinner = document.getElementById("blacklistLoadingSpinner");
    // Show loading spinner and clear previous lists
    loadingSpinner.style.display = "block"; 

    // API call to reset blacklist on the server for User 1
    try {
        let response = await fetch(`/reset_blacklist/${allUsers[1].username}`, { method: "DELETE" });
        if (!response.ok) throw new Error("Failed to reset User 2 blacklist");
        console.log("User 2 blacklist reset successfully");

        // Trigger compare button action to update recommendations
        // Function to wait for compare button action to complete
        async function waitForCompareUpdate() {
            return new Promise((resolve) => {
                function onCompareComplete() {
                    console.log("Compare button action completed.");
                    resolve();
                }

                compareButton.addEventListener("compareComplete", onCompareComplete, { once: true });

                const event = new Event("click", { bubbles: true });
                event.refresh = 1;
                compareButton.dispatchEvent(event);
            });
        }

        console.log("Waiting for compare button action...");
        await waitForCompareUpdate();
        console.log("Compare button action completed.");

    } catch (error) {
        console.error(error);
        alert("Error resetting User 2 blacklist");
    }
    finally {
        // Hide loading spinner
        loadingSpinner.style.display = "none";
    }
});







////////////////////////////////////////// Movie Modal //////////////////////////////////////////
// Listen for click events on the body
document.body.addEventListener("click", async function (event) {

    let modalTrigger = event.target.closest(".open-movie-modal");

    if (event.target.matches("button[id^='explain_']")) {
        const slug = event.target.getAttribute("data-slug");
        const weight = event.target.getAttribute("data-weight");
        const title = event.target.getAttribute("data-title");
        const year = event.target.getAttribute("data-year");
        explainMovie(slug, title, year, weight);
    }
    else if (event.target.matches("button[id^='blacklist_']")) {
        const slug = event.target.getAttribute("data-slug");
        const weight = event.target.getAttribute("data-weight");
        const title = event.target.getAttribute("data-title");
        const year = event.target.getAttribute("data-year");
        blacklistMovie(slug, title, year, weight);
    }
    else if (modalTrigger) {

        // Remove existing modal if it exists
        let existingModal = document.getElementById("dynamicModal");
        if (existingModal) {
            existingModal.remove();
            document.querySelector(".modal-backdrop").remove();
        }

        let slug = modalTrigger.getAttribute("slug");
        const response = await fetch(`/fetch_movie_data_for_modal/${slug}/${allUsers[0].username}/${allUsers[1].username}`);
        if (!response.ok) throw new Error("Something went wrong getting movie modal data");
        const movie = await response.json();

        // Create modal HTML
        let modalHtml = await CreateModal(movie);

        // Append modal to body
        document.body.insertAdjacentHTML("beforeend", modalHtml);

        // Show the modal
        let modal = new bootstrap.Modal(document.getElementById("dynamicModal"));
        modal.show();

        // Get filter settings
        const minRating = document.getElementById('minRating').value;
        const maxRating = document.getElementById('maxRating').value;
        const minRuntime = document.getElementById('minRuntime').value;
        const maxRuntime = document.getElementById('maxRuntime').value;
        const minYear = document.getElementById('minYear').value;
        const maxYear = document.getElementById('maxYear').value;

        // Fetch similar movies and populate the DOM
        const response2 = await fetch(`/fetch_similar_movies/${movie.slug}/${minRating}/${maxRating}/${minRuntime}/${maxRuntime}/${minYear}/${maxYear}`);
        const data = await response2.json();

        if (!data.success)
        {
            console.log("No similar movies found");
            document.getElementById("similarMoviesContainer").classList.add('d-none');
        } 
        else {

            const movies = data.movies;

            for (let i = 0; i < movies.length; i++) {
                let similarMovie = movies[i];
                let similarMovieHtml = `
                <div class="col">
                    <img src="${similarMovie.poster}" 
                        class="card-img-top rounded open-movie-modal" 
                        alt="${similarMovie.title}"
                        slug="${similarMovie.slug}">
                </div>
                `;
                document.getElementById("similarMovies").insertAdjacentHTML("beforeend", similarMovieHtml);
            }

            document.getElementById("similarMoviesContainer").classList.remove('d-none');

        }
            


        // Remove modal from DOM after it's closed
        document.getElementById("dynamicModal").addEventListener("hidden.bs.modal", function () {
            this.remove();
                // Remove backdrop only if no modals are open
            setTimeout(() => {
                if (document.querySelectorAll(".modal.show").length === 0) {
                    document.querySelectorAll(".modal-backdrop").forEach(el => el.remove());

                    // Restore Bootstrap's default body padding (prevents page shift)
                    document.body.style.overflow = "";
                    document.body.style.paddingRight = "";
                }
            }, 100); // Delay ensures Bootstrap fully updates the UI first
        });
    }
});

// Create movie modal HTML
async function CreateModal(movie) {

    let letterboxd_logo = "https://a.ltrbxd.com/logos/letterboxd-mac-icon.png" //"https://a.ltrbxd.com/logos/letterboxd-logo-v-neg-rgb.svg" 

    let modalHtml = `
        <div class="modal fade" id="dynamicModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered" style="max-width: 40%; width: 40%;">
            <div class="modal-content">
                <div class="modal-body p-0">
                    <div class="card position-relative">
                        <div class="card-img-wrap">
                            <button type="button" 
                                    class="btn-close position-absolute top-0 end-0 m-2"
                                    data-bs-dismiss="modal" 
                                    aria-label="Close"
                                    style="z-index: 10; background-color: white; border-radius: 50%; padding: 10px;">
                            </button>
                            <img src="${movie.banner}" 
                                class="card-img-top img-fluid" 
                                alt="${movie.title}"
                                style="object-fit: cover; height: 300px; object-position: top;">
                        </div>
                        <div class="card-body">
                            <div class="row g-3">
                                <div class="col-lg-2">
                                    <img src="${movie.poster}" 
                                        class="card-img rounded" 
                                        style="object-fit: contain;" 
                                        alt="${movie.title}">
                                </div>
                                <div class="col-lg-10">
                                    <a href="${movie.letterboxd_link}" class="text-decoration-none edit-blacklist-link" style="font-size: 1.5em; font-weight: bolder; color: inherit;" target="_blank" rel="noopener noreferrer">${movie.title} (${movie.year})</a>
                                    <h6 class="card-subtitle mt-3 mb-2 text-muted">Runtime: ${movie.runtime} mins | ${movie.genres}</h6> 
                                    <p class="card-text">${movie.description}</p>
                                    <p class="card-text no-spacing text-muted"><small>Director: ${movie.director}</small></p>
                                    <p class="card-text no-spacing text-muted"><small>Cast: ${movie.actors}</small></p>
                                    <a href="${movie.trailer}" class="text-decoration-none" target="_blank" rel="noopener noreferrer"><small>Watch trailer<small></a>
                                </div>
                            </div>
                            
                            <div class="row g-3 mt-1 justify-content-between">
                                <div class="col-md-3 d-flex flex-column align-items-center">
                                    <h5 class="text-center mb-2 text-muted">${movie.rating}</h5>
                                    <img src="${letterboxd_logo}" style="width: 50px; height: 50px;">
                                    <p class="text-muted text-center"><small>Letterboxd</small></p>
                                </div>
                                <div class="col-md-3 d-flex flex-column align-items-center">
                                    <h5 class="text-center mb-2 ${movie.score_1_color}">${movie.score_1}</h5>
                                    <img src="${allUsers[0].avatar}" class="rounded-circle" style="width: 50px; height: 50px; border: 1px solid rgba(130, 130, 130, 1);">
                                    <p class="text-muted text-center"><small>${allUsers[0].name}</small></p>
                                </div>     
                                <div class="col-md-3 d-flex flex-column align-items-center">
                                    <h5 class="text-center mb-2 ${movie.score_2_color}">${movie.score_2}</h5>
                                    <img src="${allUsers[1].avatar}" class="rounded-circle" style="width: 50px; height: 50px; border: 1px solid rgba(130, 130, 130, 1);">
                                    <p class="text-muted text-center"><small>${allUsers[1].name}</small></p>
                                </div>    
                                <div class="col-md-3 d-flex flex-column align-items-center">
                                    <h5 class="text-center mb-2 ${movie.score_combined_color}">${movie.score_combined}</h5>
                                    <div class="avatar-group-container" style="display: flex; justify-content: center;">
                                        <div class="avatar-group">
                                            <img src="${allUsers[0].avatar}" class="avatar-img avatar-img-1">
                                            <img src="${allUsers[1].avatar}" class="avatar-img avatar-img-2">
                                        </div>
                                    </div>
                                    <p class="text-muted text-center"><small>Combined</small></p>
                                </div>          
                            </div>

                            <class="container-fluid" id="similarMoviesContainer">

                                <hr class="my-3 w-75 mx-auto">

                                <div class="w-100 p-2">
                                    <h5 class="text-center text-muted">Movies similar to ${movie.title}:</h5>   
                                </div>
                                <div class="row hover-zoom g-3 justify-content-evenly p-2" id="similarMovies">         
                                </div>
                            </div>
                            
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    return modalHtml;
}

////////////////////////////////////////// Set Display Names //////////////////////////////////////////
function setDisplayNames(user1_name, user2_name) {
    document.getElementById("commonWatchlistCount").textContent = '...';
    // document.getElementById("RC-name-1").textContent = "Rewatches for " + user1_name;
    // document.getElementById("RC-name-2").textContent = "Rewatches for " + user2_name;
    // document.getElementById("RC-sub-1").textContent = "Movies watched by " + user1_name + " that " + user2_name + " might like!";
    // document.getElementById("RC-sub-2").textContent = "Movies watched by " + user2_name + " that " + user1_name + " might like!";
    // document.getElementById(`SWL1_title`).textContent = `On ${user1_name}'s`;
    // document.getElementById(`SWL1_subtitle`).textContent = `Movies on ${user1_name}'s watchlist that ${user2_name} might like!`;
    // document.getElementById(`SWL2_title`).textContent = `On ${user2_name}'s`;
    // document.getElementById(`SWL2_subtitle`).textContent = `Movies on ${user2_name}'s watchlist that ${user1_name} might like!`;
    // document.getElementById(`RC_user1_name`).textContent = `${user1_name}`;
    // document.getElementById(`RC_user2_name`).textContent = `${user2_name}`;
}



////////////////////////////////////////// Compare Button //////////////////////////////////////////
document.getElementById('compareButton').addEventListener('click', async function (event) {

    document.getElementById("go-spinner").style.display = "block"; // Show loading spinner

    

    const username1 = allUsers[0].username;
    const username2 = allUsers[1].username;

    const refresh = event.refresh ?? 0; // Use event.refresh if available, otherwise default to true
    if (refresh == 0) {
        document.getElementById("contentContainer").classList.add('d-none');
        await InitializeAndTrain(username1, username2);
    }
    else if (refresh == 1){
        // Show the content container
        await InitializeAndTrain(username1, username2);
    }

    // Set display names
    const user1_name = allUsers[0].name;
    const user2_name = allUsers[1].name;
    setDisplayNames(user1_name, user2_name);

    // Get filter settings
    const minRating = document.getElementById('minRating').value;
    const maxRating = document.getElementById('maxRating').value;
    const minRuntime = document.getElementById('minRuntime').value;
    const maxRuntime = document.getElementById('maxRuntime').value;
    const minYear = document.getElementById('minYear').value;
    const maxYear = document.getElementById('maxYear').value;

    // Fetch content data
    await FetchCommonWatchlist(minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear);

    // Fetch single watchlist data
    await FetchSingleWatchlist(minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear);

    // Fetch rewatchlist data
    generateRewatchCarousels(allUsers, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear);
    // const realRewatchCombo1 = document.querySelector('#carousel1 .carousel-inner');
    // await FetchRewatchlist(username1, username2, realRewatchCombo1, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear);
    // const realRewatchCombo2 = document.querySelector('#carousel2 .carousel-inner');
    // await FetchRewatchlist(username2, username1, realRewatchCombo2, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear);

    //document.getElementById('RecommendContainerReal').classList.add('d-none');
    // Show the content container

    document.getElementById("contentContainer").classList.remove('d-none');
    
    // Get the selected radio button's weight
    // const selectedRadio = document.querySelector('input[name="btnradio"]:checked');
    // const associatedLabel = document.querySelector(`label[for="${selectedRadio.id}"]`);
    // const weight = parseInt(associatedLabel.getAttribute("weight"), 10);
    // Get Recommendations
    generateRecUserButtons();
    //await FetchRecommendations(username1, username2, 0, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear);
    
    // Show the real recommendations content
    //document.getElementById("RecommendContainerReal").classList.remove('d-none');
    document.getElementById("RecommendContainerReal").scrollTop = 0;
    document.getElementById("go-spinner").style.display = "none"; // Hide loading spinner

    // Fire the event so `waitForCompareUpdate()` knows it's done
    const completeEvent = new Event("compareComplete");
    document.getElementById("compareButton").dispatchEvent(completeEvent);

    AOS.refresh(); // <- This tells AOS to re-scan the DOM
    

});

function getActiveUsernames() {
    const container = document.getElementById("userButtonsContainer");
    const activeButtons = container.querySelectorAll("button.active");
    return Array.from(activeButtons).map(btn => btn.getAttribute("data-user"));
}


function generateRecUserButtons() {
    const container = document.getElementById("userButtonsContainer");
    container.innerHTML = ""; // Clear previous buttons

    const minRating = document.getElementById('minRating').value;
    const maxRating = document.getElementById('maxRating').value;
    const minRuntime = document.getElementById('minRuntime').value;
    const maxRuntime = document.getElementById('maxRuntime').value;
    const minYear = document.getElementById('minYear').value;
    const maxYear = document.getElementById('maxYear').value;

    allUsers.forEach((user, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn btn-outline-warning";
        button.innerText = user.name;
        button.setAttribute("weight", 1); // Optional: for custom logic
        button.setAttribute("data-user", user.username); // Optional: for custom logic
        // set button active
        button.classList.add("active");

        // Optional: specific IDs for known users
        button.id = `user-btn-${user}`;

        // Toggle active class on click
        button.addEventListener("click", () => {
            button.classList.toggle("active");

            // Pass them to FetchRecommendations
            FetchRecommendations(getActiveUsernames(), minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear);
        });

        container.appendChild(button);
    });

    const allActiveUsers = allUsers.map(u => u.username);
    FetchRecommendations(allActiveUsers, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear);
}

////////////////////////////////////////// Radio Buttons //////////////////////////////////////////
// document.querySelectorAll('input[name="btnradio"]').forEach(radio => {
//     radio.addEventListener("change", async function () {

//         const selectedRadio = document.querySelector('input[name="btnradio"]:checked');
//         const associatedLabel = document.querySelector(`label[for="${selectedRadio.id}"]`);
//         const weight = parseInt(associatedLabel.getAttribute("weight"), 10);

//         // Get filter settings
//         const minRating = document.getElementById('minRating').value;
//         const maxRating = document.getElementById('maxRating').value;
//         const minRuntime = document.getElementById('minRuntime').value;
//         const maxRuntime = document.getElementById('maxRuntime').value;
//         const minYear = document.getElementById('minYear').value;
//         const maxYear = document.getElementById('maxYear').value;

//         document.getElementById("RecommendContainerReal").classList.add('d-none');
//         await FetchRecommendations(allUsers[0].username, allUsers[1].username, weight, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear);
//         document.getElementById("RecommendContainerReal").classList.remove('d-none');
//         document.getElementById("RecommendContainerReal").scrollTop = 0;
//         });
// });


async function FetchRecommendations(usernames, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear) {
    try {

        if (usernames.length === 0) {
            console.error("No users selected for recommendations.");
            const realRecommendContent = document.getElementById("RecommendContainerReal");
            realRecommendContent.innerHTML = "";  // Clear content efficiently
            return;
        }

        // You can join them with commas (or however your backend expects)
        const response = await fetch(`/fetch_recommendations/${usernames.join(",")}/${minRating}/${maxRating}/${minRuntime}/${maxRuntime}/${minYear}/${maxYear}`);
        if (!response.ok) throw new Error("Something went wrong getting recommendations");
        const data = await response.json();

        const weight = 0;

        const realRecommendContent = document.getElementById("RecommendContainerReal");
        realRecommendContent.innerHTML = "";  // Clear content efficiently

        const fragment = document.createDocumentFragment(); // Create a Document Fragment

        let index = 0;
        data.forEach(movie => {
            index += 1;

            // Create a new div for each movie and append to the fragment
            const movieElement = document.createElement("div");
            movieElement.classList.add("row");
            movieElement.innerHTML = `
                <div class="col-auto align-items-center d-flex justify-content-end" style="width: 50px;">
                    <h5 class="text-end">${index}.</h5>
                </div>

                <div class="col">
                    <div class="card rec-card open-movie-modal mb-3" slug="${movie.slug}">
                        <div class="row g-0" >
                            <div class="col-auto">
                                <img src="${movie.poster}" class="rec-card-img open-movie-modal rounded-start" alt="${movie.title}" slug="${movie.slug}">
                            </div>

                            <div class="col">
                                <div class="card-body" slug="${movie.slug}">
                                    <h5 class="card-title">${movie.title} (${movie.year})</h5>
                                    <p class="card-text no-spacing text-muted">${movie.genres}</p> 
                                    <p class="card-text no-spacing text-muted">${movie.runtime} mins</p> 
                                </div>
                            </div>

                            <div class="col-auto p-4 align-items-center d-flex flex-column justify-content-center">
                                <h4 class="text-top text-score p">${movie.score}%</h4>
                            </div>

                            <div class="col-auto p-2 align-items-center  d-flex flex-column justify-content-center">
                                <button type="button" class="btn btn-outline-warning mb-2 explain-btn" 
                                    id="explain_${movie.slug}_${weight}_${index}" data-slug="${movie.slug}" data-title="${movie.title}" data-year="${movie.year}" data-weight="${weight}">?
                                </button>
                            </div>
                            <div class="col-auto p-2 align-items-center  d-flex flex-column justify-content-center" style="margin-right: 20px;">
                                <button type="button" class="btn btn-outline-danger mb-2" 
                                    id="blacklist_${movie.slug}_${weight}_${index}" data-slug="${movie.slug}" data-title="${movie.title}" data-year="${movie.year}" data-weight="${weight}">&#10005;
                                </button>
                            </div>

                        </div>
                    </div>
                </div>
            `;

            fragment.appendChild(movieElement);
        });

        // Append all movie elements to the DOM in one go
        realRecommendContent.appendChild(fragment);

    } catch (error) {
        console.error(error);
    }
}

