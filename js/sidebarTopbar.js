apiBasetemp = (location.port === '5501'||location.port === '5500' || location.hostname === '127.0.0.1') ? 'http://localhost:3000/api' : '/api';
window.data = null; 
window.CurrentRole = null; 
let rolesString;
async function loadProfile1() {
  const apiUrl = `${apiBasetemp}/faculty`;
  try {
    const res = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${localStorage.getItem("authTokenNT")}`,
        "Content-Type": "application/json"
      }
    });

    window.data = await res.json();

    if (!res.ok) {
      console.error("API error:", window.data);
      alert("No data found");
      window.location.href = "https://iqac-faculty.vercel.app/";
      return;
    }

    // 🔹 MIScode returned from backend root
    const MIScode = window.data.miscode || "";
  
    // 🔹 Find the faculty record with matching MIScode
    const profile = (window.data.results || []).find(
      r => (r.MIScode || r.miscode || "").trim() === MIScode
    );

    if (!profile) {
      console.warn("No profile found for MIScode:", MIScode);
      alert("No profile found for your account.");
      return;
    }

    // 🔹 Extract roles and current role from profile row
    const rolesString = profile.Roles || "Faculty";
    const currentRole = window.data.CurrentRole || "NT";

    // Small delay to ensure DOM is ready
    setTimeout(() => {
      const rolesArray = rolesString.split(",").map(role => role.trim());
      const roleDropdown = document.getElementById("roleDropdown");

      if (roleDropdown) {
        roleDropdown.innerHTML = ""; // Clear existing options

        rolesArray.forEach(role => {
          const option = document.createElement("option");
          option.value = role;
          option.textContent = role;
          if (role.toLowerCase() === currentRole.toLowerCase()) {
            option.selected = true;
          }
          roleDropdown.appendChild(option);
        });

        // Handle change event
        roleDropdown.addEventListener("change", () => {
          const role = roleDropdown.value.trim().toUpperCase();

          // Role → URL mapping
          let path1 = "";
          if (role === "HEAD") path1 = "https://iqac-hod.vercel.app";
          else if (role === "ADMIN") path1 = "https://iqac-admin.vercel.app";
          else if (role === "FACULTY") path1 = "https://iqac-faculty.vercel.app";
          else path1 = "https://iqac-dc.vercel.app";

          if (!path1) return;

          function encrypt(d1) {
            return CryptoJS.AES.encrypt(d1, "ghjfbdfjrcdjghrfjd").toString();
          }
          const encryptedParams = new URLSearchParams({
            abc: encrypt(MIScode),
            def: encrypt(role)
          });
          const url = `${path1}?${encryptedParams.toString()}`;
          window.open(url, "_blank");
          location.reload();
        });
      } else {
        console.error("roleDropdown element not found!");
      }
    }, 100);

  } catch (error) {
    console.error("Error loading profile:", error);
  }
}

document.addEventListener("DOMContentLoaded", () => {
loadProfile1();});
 // Mobile sidebar functionality
    function toggleMobileSidebar() {
      if (window.innerWidth > 768) return;
      
      const sidebar = document.getElementById('sidebar');
      const overlay = document.getElementById('sidebarOverlay') || createOverlay();
      
      if (sidebar) {
        sidebar.classList.remove('collapsed');
        
        if (sidebar.classList.contains('show')) {
          closeMobileSidebar();
        } else {
          sidebar.classList.add('show');
          if (overlay) {
            overlay.classList.add('show');
          }
          document.body.style.overflow = 'hidden';
        }
      }
    }

    function closeMobileSidebar() {
      const sidebar = document.getElementById('sidebar');
      const overlay = document.getElementById('sidebarOverlay');
      
      if (sidebar) {
        sidebar.classList.remove('show');
      }
      if (overlay) {
        overlay.classList.remove('show');
      }
      document.body.style.overflow = '';
    }

    function createOverlay() {
      if (window.innerWidth <= 768) {
        const overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        overlay.id = 'sidebarOverlay';
        document.body.appendChild(overlay);
        return overlay;
      }
      return null;
    }

    // Event delegation for mobile menu toggle
    document.addEventListener('click', function(e) {
      if (e.target.closest('#mobileMenuToggle')) {
        e.preventDefault();
        e.stopPropagation();
        toggleMobileSidebar();
      }
      
      if (e.target.id === 'sidebarOverlay') {
        closeMobileSidebar();
      }

      if (window.innerWidth <= 768 && e.target.closest('.sidebar .nav-link')) {
        setTimeout(() => closeMobileSidebar(), 100);
      }
    });

    Promise.all([
      fetch('sidebar.html').then(res => res.text()),
      fetch('topbar.html').then(res => res.text())
    ]).then(([sidebarHtml, topbarHtml]) => {
      document.getElementById('sidebarContainer').innerHTML = sidebarHtml;
      document.getElementById('topbarContainer').innerHTML = topbarHtml;

      const token = localStorage.getItem("authTokenNT");
      if (!token) {
        window.location.href = "logout.html";
        return;
      }
      createOverlay();
    }).catch(error => {
      console.error('Error loading sidebar/topbar:', error);
    });
    document.addEventListener("DOMContentLoaded", () => {
      document.body.addEventListener("click", function (e) {
        if (e.target.closest("#toggleSidebar")) {
          if (window.innerWidth > 768) {
            document.getElementById("sidebar").classList.toggle("collapsed");
          }
        }
      });
    });













