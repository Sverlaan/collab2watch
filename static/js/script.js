

// Toggle the theme between dark and light
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute("data-bs-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-bs-theme", newTheme);

    // Update the icon
    updateIcon(newTheme);
}
// Update the icon based on the current theme
function updateIcon(theme) {
    const icon = document.getElementById("theme-icon");
    if (theme === "dark") {
        icon.classList.remove("bi-sun");
        icon.classList.add("bi-moon");
    } else {
        icon.classList.remove("bi-moon");
        icon.classList.add("bi-sun");
    }
}

// event handler for resetFilters button click
const resetButton = document.getElementById('resetFilters');
resetButton.addEventListener('click', function (event) {
    console.log("Reset button clicked!");
    // reset form filters in modal
    document.getElementById('minRating').value = 0;
    document.getElementById('maxRating').value = 5;
    document.getElementById('minRuntime').value = 0;
    document.getElementById('maxRuntime').value = 300;
    document.getElementById('minYear').value = 1870;
    document.getElementById('maxYear').value = 2025;

});

const applyButton = document.getElementById('applyFilters');
applyButton.addEventListener('click', async function (event) {

    const compareButton = document.getElementById('compareButton');
    if (!compareButton.disabled) {
        compareButton.click();
    }
});





let user1_name = " "
let user2_name = " "

// Fetch user data from Flask backend and populate the DOM
async function fetchUserData(username, user_id, NameElement, AvatarElement, StatsElement1, RewatchesNameElement) {
    try {
        const response = await fetch(`/get_user/${username}`);
        if (!response.ok) throw new Error("User not found");
        const data = await response.json();
        
        // Update the DOM with fetched data
        document.getElementById(NameElement).innerHTML =  `<a href="${data.user_url}" class="text-decoration-none" style="font-weight: bolder;" target="_blank" rel="noopener noreferrer">${data.name}</a>`;
        document.getElementById(AvatarElement).src = data.avatar;
        document.getElementById(StatsElement1).textContent = "Watched: " + data.num_movies_watched + "  |  " + "Watchlist: " + data.watchlist_length;
        if (user_id == 1) {
            user1_name = data.name;
        } else {
            user2_name = data.name;
        }
        
        // Flag the correct submission
        console.log("Fetched data");
        if (user_id == 1) {
            form1Submitted = true;
        }
        else {
            form2Submitted = true;
        }
        // Check if both users are submitted successfully
        checkIfBothSubmitted();

    } catch (error) {
        console.error(error);

        // Update the DOM with fetched data
        document.getElementById(NameElement).textContent = "User not found. Try again:";
        document.getElementById(AvatarElement).src = "https://s.ltrbxd.com/static/img/avatar1000.d3d753e6.png";
        document.getElementById(StatsElement1).textContent = "Only Letterboxd accounts are supported.";

        // Reset correct submission flag
        if (user_id == 1) {
            form1Submitted = false;
        }
        else {
            form2Submitted = false;
        }
        checkIfBothSubmitted();
    }
}

// Fetch common watchlist from Flask backend and populate the DOM
async function FetchCommonWatchlist(username1, username2, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear) {
    try {
        const response = await fetch(`/fetch_common_watchlist/${username1}/${username2}/${minRating}/${maxRating}/${minRuntime}/${maxRuntime}/${minYear}/${maxYear}`);
        if (!response.ok) throw new Error("Something went wrong getting common watchlist");
        const data = await response.json();

        const realContent = document.getElementById("realContent");
        // delete all existing cards
        while (realContent.firstChild) {
            realContent.removeChild(realContent.firstChild);
        }

        document.getElementById("commonWatchlistCount").textContent = data.length;

        // Loop through the data and generate the cards + modals
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
async function FetchRewatchCombo(username1, username2, realRewatchCombo, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear) {
    try {
        const response = await fetch(`/fetch_rewatch_combo/${username1}/${username2}/${minRating}/${maxRating}/${minRuntime}/${maxRuntime}/${minYear}/${maxYear}`);
        if (!response.ok) throw new Error("Something went wrong getting rewatch combo");
        const data = await response.json();
        
        // delete all existing carousel items
        while (realRewatchCombo.firstChild) {
            realRewatchCombo.removeChild(realRewatchCombo.firstChild);
        }

        // Loop through the data and generate the cards + modals
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

document.body.addEventListener("click", async function (event) {
    if (event.target.classList.contains("open-movie-modal")) {
        
        
        // Remove existing modal if it exists
        let existingModal = document.getElementById("dynamicModal");
        if (existingModal) {
            existingModal.remove();
        }

        let slug = event.target.getAttribute("slug");
        const response = await fetch(`/fetch_movie_data_for_modal/${slug}`);
        if (!response.ok) throw new Error("Something went wrong getting movie modal data");
        const movie = await response.json();

        // Create modal HTML
        let modalHtml = CreateModal(movie);

        // Append modal to body
        document.body.insertAdjacentHTML("beforeend", modalHtml);

        // Show the modal
        let modal = new bootstrap.Modal(document.getElementById("dynamicModal"));
        modal.show();

        // Remove modal from DOM after it's closed
        document.getElementById("dynamicModal").addEventListener("hidden.bs.modal", function () {
            this.remove();
        });
    }
});

function CreateModal(movie) {
    // Create modal HTML

    // if enhance button is clicked, show more details
    enhanceButton = document.getElementById("btn-check-outlined");
    if (enhanceButton.checked) {
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
                                        <a href="${movie.letterboxd_link}" class="text-decoration-none" style="font-size: 1.5em; font-weight: bolder;" target="_blank" rel="noopener noreferrer">${movie.title} (${movie.year})</a>
                                        <h6 class="card-subtitle mt-3 mb-2 text-muted">Runtime: ${movie.runtime} mins | ${movie.genres}</h6> 
                                        <p class="card-text">${movie.description}</p>
                                        <p class="card-text no-spacing text-muted"><small>Director: ${movie.director}</small></p>
                                        <p class="card-text no-spacing text-muted"><small>Cast: ${movie.actors}</small></p>
                                        <a href="${movie.trailer}" class="text-decoration-none" target="_blank" rel="noopener noreferrer"><small>Watch trailer<small></a>
                                    </div>
                                </div>
                                <hr class="my-3 w-75 mx-auto">
                                <div class="row g-3 justify-content-center">
                                    <div class="col-md-6">
                                        <h4 class="text-center mb-2 text-muted">${movie.rating}</h4>
                                        <p class="text-center text-muted">Letterboxd</p>
                                    </div>
                                    <div class="col-md-6">
                                        <h4 class="text-center mb-2 text-warning">TBA</h4>
                                        <p class="text-center text-warning">Expected score</p>
                                    </div>                            
                                </div>
                                <hr class="my-3 w-75 mx-auto">
                                <div class="row g-3 justify-content-center">
                                    <h5 class="text-center mb-2 text-warning">Similar Films:</h5>
                                    <div class="col-md-3">
                                        <h6 class="text-center mb-2 text-muted">Movie1</h6>
                                    </div>
                                    <div class="col-md-3">
                                        <h6 class="text-center mb-2 text-muted">Movie2</h6>
                                    </div>
                                    <div class="col-md-3">
                                        <h6 class="text-center mb-2 text-muted">Movie3</h6>
                                    </div>
                                    <div class="col-md-3">
                                        <h6 class="text-center mb-2 text-muted">Movie4</h6
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
    else {
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
                                        <a href="${movie.letterboxd_link}" class="text-decoration-none" style="font-size: 1.5em; font-weight: bolder;" target="_blank" rel="noopener noreferrer">${movie.title} (${movie.year})</a>
                                        <h6 class="card-subtitle mt-3 mb-2 text-muted">Runtime: ${movie.runtime} mins | ${movie.genres}</h6> 
                                        <p class="card-text">${movie.description}</p>
                                        <p class="card-text no-spacing text-muted"><small>Director: ${movie.director}</small></p>
                                        <p class="card-text no-spacing text-muted"><small>Cast: ${movie.actors}</small></p>
                                        <a href="${movie.trailer}" class="text-decoration-none" target="_blank" rel="noopener noreferrer"><small>Watch trailer<small></a>
                                    </div>
                                </div>
                                <hr class="my-3 w-75 mx-auto">
                                <div class="row g-3 justify-content-center">
                                    <div class="col-md-6">
                                        <h4 class="text-center mb-2 text-muted">${movie.rating}</h4>
                                        <p class="text-center text-muted">Letterboxd</p>
                                    </div>
                                    <div class="col-md-6">
                                        <h4 class="text-center mb-2 text-warning">TBA</h4>
                                        <p class="text-center text-warning">Expected score</p>
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
}




// Get references to the form and input for the first user
const form_username1 = document.getElementById('usernameForm1');
const inputUsername1 = document.getElementById('inputUsername1');

// Get references to the form and input for the second user
const form_username2 = document.getElementById('usernameForm2');
const inputUsername2 = document.getElementById('inputUsername2');

// Get reference to the compare button
const compareButton = document.getElementById('compareButton');
// Listen for the compare button click event
compareButton.addEventListener('click', async function (event) {

    console.log("Compare button clicked!");
    
    const commonWatchlistContainer = document.getElementById('CommonWatchlistContainer');
    const loadingPlaceholders = document.getElementById('loadingPlaceholders');
    const realContent = document.getElementById('realContent');
    document.getElementById("commonWatchlistCount").textContent = '...';

    const rewatchComboContainer = document.getElementById('RewatchComboContainer');
    const placeholderRC1 = document.getElementById('placeholderRC1');
    const placeholderRC2 = document.getElementById('placeholderRC2');
    const carouselRC1 = document.getElementById('carousel1');
    const carouselRC2 = document.getElementById('carousel2');
    const recommendContainer = document.getElementById('RecommendContainer');
    document.getElementById("RC-name-1").textContent = "Rewatches for " + user1_name;
    document.getElementById("RC-name-2").textContent = "Rewatches for " + user2_name;
    document.getElementById("RC-sub-1").textContent = "Movies on " + user2_name + "'s watchlist that are highly rated by " + user1_name;
    document.getElementById("RC-sub-2").textContent = "Movies on " + user1_name + "'s watchlist that are highly rated by " + user2_name;

    // Show the container and placeholders, hide the real content
    commonWatchlistContainer.classList.remove('d-none'); 
    loadingPlaceholders.classList.remove('d-none'); 

    rewatchComboContainer.classList.remove('d-none');
    placeholderRC1.classList.remove('d-none');
    placeholderRC2.classList.remove('d-none');
    recommendContainer.classList.remove('d-none');

    realContent.classList.add('d-none'); 
    carouselRC1.classList.add('d-none');
    carouselRC2.classList.add('d-none');

    // Get maximum runtime from the form
    const minRating = document.getElementById('minRating').value;
    const maxRating = document.getElementById('maxRating').value;
    const minRuntime = document.getElementById('minRuntime').value;
    const maxRuntime = document.getElementById('maxRuntime').value;
    const minYear = document.getElementById('minYear').value;
    const maxYear = document.getElementById('maxYear').value;

    let username1 = inputUsername1.value;
    let username2 = inputUsername2.value;

    // Fetch common watchlist and populate the DOM
    await FetchCommonWatchlist(username1, username2, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear);

    // After loading finishes, hide placeholders and show real content
    commonWatchlistContainer.classList.remove('d-none');
    loadingPlaceholders.classList.add('d-none');
    realContent.classList.remove('d-none');

    console.log("Start fetching rewatch combo 1!");
    
    const realRewatchCombo1 = document.querySelector('#carousel1 .carousel-inner');
    await FetchRewatchCombo(username1, username2, realRewatchCombo1, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear);

    const realRewatchCombo2 = document.querySelector('#carousel2 .carousel-inner');
    await FetchRewatchCombo(username2, username1, realRewatchCombo2, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear);

    rewatchComboContainer.classList.remove('d-none');
    placeholderRC1.classList.add('d-none');
    placeholderRC2.classList.add('d-none');
    carouselRC1.classList.remove('d-none');
    carouselRC2.classList.remove('d-none');

});

// Track submission states
let form1Submitted = false;
let form2Submitted = false;

// Listen for the form submit event
form_username1.addEventListener('submit', function (event) {

    console.log("Form submitted!");
    // Prevent the form from submitting
    event.preventDefault();

    // Get the value of the input
    const username = inputUsername1.value;

    // Fetch user data and populate the DOM
    fetchUserData(username, 1, 'name-1', 'avatar-1', 'stats-1', 'rewatches-name-1');
});

// Listen for the form submit event
form_username2.addEventListener('submit', function (event) {

    console.log("Form submitted!");
    // Prevent the form from submitting
    event.preventDefault();

    // Get the value of the input
    const username = inputUsername2.value;

    // Fetch user data and populate the DOM
    fetchUserData(username, 2, 'name-2', 'avatar-2', 'stats-2', 'rewatches-name-2');
});

// Enable the Compare button if both forms are submitted
function checkIfBothSubmitted() {
    if (form1Submitted && form2Submitted) {
        document.getElementById('compareButton').disabled = false;
        console.log("Both forms True!");
    }
    else {
        document.getElementById('compareButton').disabled = true;
        const commonWatchlistContainer = document.getElementById('CommonWatchlistContainer');
        const rewatchComboContainer = document.getElementById('RewatchComboContainer');
        const recommendContainer = document.getElementById('RecommendContainer');
        commonWatchlistContainer.classList.add('d-none');
        rewatchComboContainer.classList.add('d-none');
        recommendContainer.classList.add('d-none');

    }
}