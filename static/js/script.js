

////////////////////////////////////////// Dark/Light Mode //////////////////////////////////////////
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
        event.refresh = false;
        compareButton.dispatchEvent(event);
    }
});


////////////////////////////////////////// Radio Buttons //////////////////////////////////////////
document.querySelectorAll('input[name="btnradio"]').forEach(radio => {
    radio.addEventListener("change", async function () {

        const selectedRadio = document.querySelector('input[name="btnradio"]:checked');
        const associatedLabel = document.querySelector(`label[for="${selectedRadio.id}"]`);
        const weight = parseInt(associatedLabel.getAttribute("weight"), 10);

        // Get filter settings
        const minRating = document.getElementById('minRating').value;
        const maxRating = document.getElementById('maxRating').value;
        const minRuntime = document.getElementById('minRuntime').value;
        const maxRuntime = document.getElementById('maxRuntime').value;
        const minYear = document.getElementById('minYear').value;
        const maxYear = document.getElementById('maxYear').value;

        document.getElementById("RecommendContainerReal").classList.add('d-none');
        await FetchRecommendations(inputUsername1.value, inputUsername2.value, weight, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear);
        document.getElementById("RecommendContainerReal").classList.remove('d-none');
        document.getElementById("RecommendContainerReal").scrollTop = 0;
        });
});




// Track submission states
let form1Submitted = false;
let form2Submitted = false;

////////////////////////////////////////// Fetch User Data //////////////////////////////////////////
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
            form1Submitted = true;
        }
        else {
            form2Submitted = true;
        }
        checkIfBothSubmitted();

    } catch (error) {
        console.error(error);

        document.getElementById(NameElement).textContent = "User not found";
        document.getElementById(AvatarElement).src = "https://s.ltrbxd.com/static/img/avatar1000.d3d753e6.png";
        document.getElementById(StatsElement1).textContent = "Only Letterboxd accounts are supported";
        document.getElementById("loadingProgress").style.visibility = "hidden";

        if (user_id == 1) {
            form1Submitted = false;
        }
        else {
            form2Submitted = false;
        }
        checkIfBothSubmitted();
    }
}

////////////////////////////////////////// User Profile Form Submission //////////////////////////////////////////
const inputUsername1 = document.getElementById('inputUsername1');
const inputUsername2 = document.getElementById('inputUsername2');

// Listen for the form submit event
document.getElementById('usernameForm1').addEventListener('submit', function (event) {
    event.preventDefault();
    fetchUserData(inputUsername1.value, 1, 'name-1', 'avatar-1', 'stats-1', 'rewatches-name-1');
});

// Listen for the form submit event
document.getElementById('usernameForm2').addEventListener('submit', function (event) {
    event.preventDefault();
    fetchUserData(inputUsername2.value, 2, 'name-2', 'avatar-2', 'stats-2', 'rewatches-name-2');
});

// Enable the Compare button if both forms are submitted
function checkIfBothSubmitted() {
    if (form1Submitted && form2Submitted) {
        document.getElementById('compareButton').disabled = false;
    }
    else {
        document.getElementById('compareButton').disabled = true;
        document.getElementById("contentContainer").classList.add('d-none');
    }
}


////////////////////////////////////////// Progress Bars //////////////////////////////////////////
function ResetProgressBars() {

    document.getElementById("progress1").textContent = `Fetching profile data from ${inputUsername1.value} and ${inputUsername2.value}`;
    document.getElementById("progress2").textContent = `Adding to 9.8M ratings from 11.0K other users`;

    document.getElementById("circleImagePlaceholder1").style.display = "inline-block";
    document.getElementById("circleImagePlaceholder2").style.display = "inline-block";
    document.getElementById("circleImagePlaceholder3").style.display = "inline-block";

    // Hide the checkmarks and circle images
    document.getElementById("circleImage1").style.display = "none";
    document.getElementById("circleImage2").style.display = "none";
    document.getElementById("circleImage3").style.display = "none";

    // Hide the spinners
    document.getElementById("spinner1").style.display = "none";
    document.getElementById("spinner2").style.display = "none";
    document.getElementById("spinner3").style.display = "none";

    // Make loading progress visible, remove d-none
    document.getElementById("loadingProgress").style.visibility = "visible";
}

////////////////////////////////////////// Initialization Tasks //////////////////////////////////////////
function startTasks() {
    return new Promise((resolve) => {
        function checkStatus(taskNumber) {
            fetch(`/get_status/${taskNumber}`)
                .then(response => response.json())
                .then(data => {
                    if (data.status === "complete") {
                        document.getElementById(`spinner${taskNumber}`).style.display = "none";
                        document.getElementById(`circleImagePlaceholder${taskNumber}`).style.display = "none";
                        document.getElementById(`circleImage${taskNumber}`).style.display = "inline-block";

                        if (taskNumber < 3) {
                            let nextTask = taskNumber + 1;
                            document.getElementById(`spinner${nextTask}`).style.display = "inline-block";
                            document.getElementById(`circleImagePlaceholder${nextTask}`).style.display = "none";
                            fetch(`/start_task/${nextTask}/${inputUsername1.value}/${inputUsername2.value}`)
                                .then(() => checkStatus(nextTask));
                        } else {
                            resolve();
                        }
                    } else {
                        setTimeout(() => checkStatus(taskNumber), 1000);
                    }
                });
        }

        document.getElementById("spinner1").style.display = "inline-block";
        document.getElementById("circleImagePlaceholder1").style.display = "none";
        
        fetch(`/start_task/1/${inputUsername1.value}/${inputUsername2.value}`)
            .then(() => checkStatus(1));
    });
}

////////////////////////////////////////// Fetch Content Data //////////////////////////////////////////
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
async function FetchSingleWatchlist(username1, username2, SWL_num, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear) {
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
async function FetchRewatchlist(username1, username2, realRewatchCombo, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear) {
    try {
        const response = await fetch(`/fetch_rewatchlist/${username1}/${username2}/${minRating}/${maxRating}/${minRuntime}/${maxRuntime}/${minYear}/${maxYear}`);
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

async function FetchRecommendations(username1, username2, weight, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear) {
    try {
        const response = await fetch(`/fetch_recommendations/${username1}/${username2}/${weight}/${minRating}/${maxRating}/${minRuntime}/${maxRuntime}/${minYear}/${maxYear}`);
        if (!response.ok) throw new Error("Something went wrong getting recommendations");
        const data = await response.json();

        const realRecommendContent = document.getElementById("RecommendContainerReal");
        realRecommendContent.innerHTML = "";  // Clear content efficiently

        const fragment = document.createDocumentFragment(); // Create a Document Fragment

        let index = 0;
        data.forEach(movie => {
            index += 1;

            // Determine avatar display based on weight
            let avatarHTML = "";
            if (weight === 0) {
                avatarHTML = `
                    <div class="avatar-group-B">
                        <img src="${document.getElementById('avatar-1').src}" class="avatar-img-B avatar-img-1">
                        <img src="${document.getElementById('avatar-2').src}" class="avatar-img-B avatar-img-2">
                    </div>`;
            } else if (weight === -1) {
                avatarHTML = `
                    <div>
                        <img src="${document.getElementById('avatar-1').src}" class="rounded-circle" style="width: 40px; height: 40px; border: 1px solid rgba(130, 130, 130, 1);">
                    </div>`;
            } else if (weight === 1) {
                avatarHTML = `
                    <div>
                        <img src="${document.getElementById('avatar-2').src}" class="rounded-circle" style="width: 40px; height: 40px; border: 1px solid rgba(130, 130, 130, 1);">
                    </div>`;
            }

            // Create a new div for each movie and append to the fragment
            const movieElement = document.createElement("div");
            movieElement.classList.add("row");
            movieElement.innerHTML = `
                <div class="col-auto align-items-center d-flex justify-content-end" style="width: 50px;">
                    <h5 class="text-end">${index}.</h5>
                </div>

                <div class="col">
                    <div class="card rec-card open-movie-modal mb-3" slug="${movie.slug}">
                        <div class="row g-0">
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
                                <h5 class="text-top text-score p">${movie.score}%</h5>
                                <div class="avatar-group-container" style="display: flex; justify-content: center;">
                                    ${avatarHTML}
                                </div>
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





////////////////////////////////////////// Movie Modal //////////////////////////////////////////
// Listen for click events on the body
document.body.addEventListener("click", async function (event) {

    let modalTrigger = event.target.closest(".open-movie-modal");

    if (modalTrigger) {

        // Remove existing modal if it exists
        let existingModal = document.getElementById("dynamicModal");
        if (existingModal) {
            existingModal.remove();
            document.querySelector(".modal-backdrop").remove();
        }

        let slug = modalTrigger.getAttribute("slug");
        const response = await fetch(`/fetch_movie_data_for_modal/${slug}/${inputUsername1.value}/${inputUsername2.value}`);
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
                                    <a href="${movie.letterboxd_link}" class="text-decoration-none" style="font-size: 1.5em; font-weight: bolder;" target="_blank" rel="noopener noreferrer">${movie.title} (${movie.year})</a>
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
                                    <img src="${document.getElementById('avatar-1').src}" class="rounded-circle" style="width: 50px; height: 50px; border: 1px solid rgba(130, 130, 130, 1);">
                                    <p class="text-muted text-center"><small>${document.getElementById("name-1").textContent}</small></p>
                                </div>     
                                <div class="col-md-3 d-flex flex-column align-items-center">
                                    <h5 class="text-center mb-2 ${movie.score_2_color}">${movie.score_2}</h5>
                                    <img src="${document.getElementById('avatar-2').src}" class="rounded-circle" style="width: 50px; height: 50px; border: 1px solid rgba(130, 130, 130, 1);">
                                    <p class="text-muted text-center"><small>${document.getElementById("name-2").textContent}</small></p>
                                </div>    
                                <div class="col-md-3 d-flex flex-column align-items-center">
                                    <h5 class="text-center mb-2 ${movie.score_combined_color}">${movie.score_combined}</h5>
                                    <div class="avatar-group-container" style="display: flex; justify-content: center;">
                                        <div class="avatar-group">
                                            <img src="${document.getElementById('avatar-1').src}" class="avatar-img avatar-img-1">
                                            <img src="${document.getElementById('avatar-2').src}" class="avatar-img avatar-img-2">
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
    document.getElementById("RC-name-1").textContent = "Rewatches for " + user1_name;
    document.getElementById("RC-name-2").textContent = "Rewatches for " + user2_name;
    document.getElementById("RC-sub-1").textContent = "Movies watched by " + user1_name + " that " + user2_name + " might like!";
    document.getElementById("RC-sub-2").textContent = "Movies watched by " + user2_name + " that " + user1_name + " might like!";
    document.getElementById(`SWL1_title`).textContent = `On ${user1_name}'s`;
    document.getElementById(`SWL1_subtitle`).textContent = `Movies on ${user1_name}'s watchlist that ${user2_name} might like!`;
    document.getElementById(`SWL2_title`).textContent = `On ${user2_name}'s`;
    document.getElementById(`SWL2_subtitle`).textContent = `Movies on ${user2_name}'s watchlist that ${user1_name} might like!`;
    document.getElementById(`RC_user1_name`).textContent = `${user1_name}`;
    document.getElementById(`RC_user2_name`).textContent = `${user2_name}`;
}



////////////////////////////////////////// Compare Button //////////////////////////////////////////
document.getElementById('compareButton').addEventListener('click', async function (event) {

    const refresh = event.refresh ?? true; // Use event.refresh if available, otherwise default to true
    if (refresh) {
        ResetProgressBars();
        document.getElementById("contentContainer").classList.add('d-none');
        await startTasks();
    }

    // Set id="btnradio2" checked
    document.getElementById('btnradio2').checked = true;

    // Set display names
    const user1_name = document.getElementById("name-1").textContent;
    const user2_name = document.getElementById("name-2").textContent;
    setDisplayNames(user1_name, user2_name);

    // Get filter settings
    const minRating = document.getElementById('minRating').value;
    const maxRating = document.getElementById('maxRating').value;
    const minRuntime = document.getElementById('minRuntime').value;
    const maxRuntime = document.getElementById('maxRuntime').value;
    const minYear = document.getElementById('minYear').value;
    const maxYear = document.getElementById('maxYear').value;

    // Fetch content data
    const username1 = inputUsername1.value;
    const username2 = inputUsername2.value;
    await FetchCommonWatchlist(username1, username2, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear);
    await FetchSingleWatchlist(username1, username2, 1, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear);
    await FetchSingleWatchlist(username2, username1, 2, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear);
    const realRewatchCombo1 = document.querySelector('#carousel1 .carousel-inner');
    await FetchRewatchlist(username1, username2, realRewatchCombo1, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear);
    const realRewatchCombo2 = document.querySelector('#carousel2 .carousel-inner');
    await FetchRewatchlist(username2, username1, realRewatchCombo2, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear);

    document.getElementById('RecommendContainerReal').classList.add('d-none');
    // Show the content container
    document.getElementById("contentContainer").classList.remove('d-none');
    
    // Get the selected radio button's weight
    const selectedRadio = document.querySelector('input[name="btnradio"]:checked');
    const associatedLabel = document.querySelector(`label[for="${selectedRadio.id}"]`);
    const weight = parseInt(associatedLabel.getAttribute("weight"), 10);
    // Get Recommendations
    await FetchRecommendations(username1, username2, weight, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear);
    
    // Show the real recommendations content
    document.getElementById("RecommendContainerReal").classList.remove('d-none');
    document.getElementById("RecommendContainerReal").scrollTop = 0;

});

