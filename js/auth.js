
showLoader();
const params = new URLSearchParams(window.location.search);
const mis = decrypt(params.get("abc"));
const role = decrypt(params.get("def"));
if(!mis || !role){
         alert(`You are not authorized. ${data.message || ""}`);
        window.location.href = "https://iqac-faculty.vercel.app/";
}
function decrypt(encryptedData) {
    const bytes = CryptoJS.AES.decrypt(encryptedData, "ghjfbdfjrcdjghrfjd");
    return bytes.toString(CryptoJS.enc.Utf8);
}
// Use encodeURIComponent before sending to API
fetch(`/api/auth?abc=${mis}&def=${role}`)
  .then(async res => {
      const text = await res.text(); 
      try {
          const data = JSON.parse(text); 
          return data;
      } catch (err) {
          throw new Error(`API returned non-JSON response: ${text}`);
      }
  })
  .then(data => {
      if (data.token) {
        // Store only the token
        localStorage.setItem("authTokenAdmin", data.token);
        window.location.href = "/dashboard.html";
    } else {
        alert(`You are not authorized. ${data.message || ""}`);
        window.location.href = "https://iqac-faculty.vercel.app/";
    }
  })
  .catch(err => {
      console.error("Error verifying role:", err);
      alert(`There was an error verifying your role: ${err.message}. Redirecting back to the main IQAC portal.`);
      window.location.href = "https://iqac-faculty.vercel.app/";
  }) .finally(() => {
            hideLoader();
        });
function createLoader() {
    if (!document.getElementById("loader")) {
        const loaderDiv = document.createElement("div");
        loaderDiv.id = "loader";
        loaderDiv.style.cssText = `
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(255, 255, 255, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            flex-direction: column;
            font-size: 20px;
            font-weight: bold;
            color: #333;
        `;
        loaderDiv.innerHTML = `
            Login... Please wait.
            <div id="spinner" style="
                border: 8px solid #1e3c72;
                border-top: 8px solid #3498db;
                border-radius: 50%;
                width: 50px;
                height: 50px;
                animation: spin 2s linear infinite;
                margin-top: 10px;
            "></div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;
        document.body.appendChild(loaderDiv);
    }
}
function showLoader() {
    createLoader();
    document.getElementById("loader").style.display = "flex";
}

function hideLoader() {
    const loader = document.getElementById("loader");
    if (loader) {
        loader.style.display = "none";
    }
}














