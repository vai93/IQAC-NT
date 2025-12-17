// Mobile Menu Functionality
document.addEventListener("DOMContentLoaded", function() {
  const mainContent = document.querySelector(".main-content");

  // Global functions for sidebar control
  function showSidebar() {
    const sidebar = document.getElementById("sidebar");
    const sidebarOverlay = document.getElementById("sidebarOverlay");
    
    // console.log('showSidebar called');
    // console.log('Sidebar element:', sidebar);
    // console.log('Sidebar overlay element:', sidebarOverlay);
    
    if (sidebar) {
      // console.log('Adding show class to sidebar');
      sidebar.classList.add("show");
      if (sidebarOverlay) {
        // console.log('Adding show class to overlay');
        sidebarOverlay.classList.add("show");
      }
    } else {
      console.log('No sidebar element found in showSidebar');
    }
  }

  function hideSidebar() {
    const sidebar = document.getElementById("sidebar");
    const sidebarOverlay = document.getElementById("sidebarOverlay");
    
    if (sidebar) {
      sidebar.classList.remove("show");
      if (sidebarOverlay) {
        sidebarOverlay.classList.remove("show");
      }
    }
  }

  // Function to wait for sidebar to be loaded
  function waitForSidebar(callback, maxAttempts = 10) {
    let attempts = 0;
    const checkSidebar = () => {
      attempts++;
      const sidebar = document.getElementById("sidebar");
      // console.log(`Checking for sidebar (attempt ${attempts}):`, sidebar);
      
      if (sidebar) {
        // console.log('Sidebar found!');
        callback();
      } else if (attempts < maxAttempts) {
        // console.log(`Sidebar not found, retrying in 500ms...`);
        setTimeout(checkSidebar, 500);
      } else {
        // console.log('Sidebar not found after maximum attempts');
      }
    };
    checkSidebar();
  }

  // Mobile menu click handler
  function mobileMenuClickHandler(e) {
    e.preventDefault();
    e.stopPropagation();
    
    // console.log('Mobile menu button clicked!');
    // console.log('Window width:', window.innerWidth);
    
    // Check sidebar container
    const sidebarContainer = document.getElementById("sidebarContainer");
    // console.log('Sidebar container:', sidebarContainer);
    // console.log('Sidebar container innerHTML length:', sidebarContainer ? sidebarContainer.innerHTML.length : 'No container');
    
    // Toggle sidebar visibility on mobile
    if (window.innerWidth <= 768) {
      waitForSidebar(() => {
        const sidebar = document.getElementById("sidebar");
        // console.log('Sidebar element found:', sidebar);
        // console.log('Sidebar classes:', sidebar ? sidebar.className : 'No sidebar');
        
        if (sidebar && sidebar.classList.contains("show")) {
          // console.log('Hiding sidebar...');
          hideSidebar();
        } else {
          // console.log('Showing sidebar...');
          showSidebar();
        }
      });
    }
  }

  // Sidebar toggle click handler
  function sidebarToggleClickHandler(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const sidebar = document.getElementById("sidebar");
    if (window.innerWidth <= 768) {
      // On mobile, toggle sidebar visibility
      if (sidebar && sidebar.classList.contains("show")) {
        hideSidebar();
      } else {
        showSidebar();
      }
    } else {
      // On desktop, toggle sidebar collapse
      if (sidebar) {
        sidebar.classList.toggle("collapsed");
        if (sidebar.classList.contains("collapsed")) {
          mainContent.classList.add("sidebar-collapsed");
        } else {
          mainContent.classList.remove("sidebar-collapsed");
        }
      }
    }
  }

  // Overlay click handler
  function overlayClickHandler() {
    hideSidebar();
  }

  // Nav link click handler
  function navLinkClickHandler() {
    // Hide sidebar on mobile when a link is clicked
    if (window.innerWidth <= 768) {
      hideSidebar();
    }
  }

  // Function to initialize mobile menu functionality
  function initializeMobileMenu() {
    const mobileMenuToggle = document.getElementById("mobileMenuToggle");
    const toggleSidebarBtn = document.getElementById("toggleSidebar");
    const sidebarOverlay = document.getElementById("sidebarOverlay");
    
    // Show mobile menu toggle button on mobile devices
    function showMobileMenuToggle() {
      if (mobileMenuToggle) {
        mobileMenuToggle.style.display = "block";
      }
    }

    // Hide mobile menu toggle button on desktop
    function hideMobileMenuToggle() {
      if (mobileMenuToggle) {
        mobileMenuToggle.style.display = "none";
      }
    }

    // Handle mobile menu toggle button click
    if (mobileMenuToggle) {
      // Remove existing event listener to prevent duplicates
      mobileMenuToggle.removeEventListener("click", mobileMenuClickHandler);
      mobileMenuToggle.addEventListener("click", mobileMenuClickHandler);
    }

    // Handle sidebar toggle button click (inside sidebar)
    if (toggleSidebarBtn) {
      // Remove existing event listener to prevent duplicates
      toggleSidebarBtn.removeEventListener("click", sidebarToggleClickHandler);
      toggleSidebarBtn.addEventListener("click", sidebarToggleClickHandler);
    }

    if (sidebarOverlay) {
      sidebarOverlay.removeEventListener("click", overlayClickHandler);
      sidebarOverlay.addEventListener("click", overlayClickHandler);
    }

    const navLinks = document.querySelectorAll(".sidebar .nav-link");
    navLinks.forEach(link => {
      link.removeEventListener("click", navLinkClickHandler);
      link.addEventListener("click", navLinkClickHandler);
    });

    // Initialize mobile menu toggle visibility
    if (window.innerWidth <= 768) {
      showMobileMenuToggle();
    } else {
      hideMobileMenuToggle();
    }
  }

  // Make initializeMobileMenu globally accessible
  window.initializeMobileMenu = initializeMobileMenu;

  // Handle window resize
  window.addEventListener("resize", function() {
    if (window.innerWidth > 768) {
      // On desktop, hide mobile sidebar and show desktop behavior
      const sidebar = document.getElementById("sidebar");
      if (sidebar) {
        sidebar.classList.remove("show");
      }
      const sidebarOverlay = document.getElementById("sidebarOverlay");
      if (sidebarOverlay) {
        sidebarOverlay.classList.remove("show");
      }
      // Hide mobile menu toggle
      const mobileMenuToggle = document.getElementById("mobileMenuToggle");
      if (mobileMenuToggle) {
        mobileMenuToggle.style.display = "none";
      }
    } else {
      // On mobile, show mobile menu toggle
      const mobileMenuToggle = document.getElementById("mobileMenuToggle");
      if (mobileMenuToggle) {
        mobileMenuToggle.style.display = "block";
      }
    }
  });

  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape") {
      const sidebar = document.getElementById("sidebar");
      if (sidebar) {
        sidebar.classList.remove("show");
      }
      const sidebarOverlay = document.getElementById("sidebarOverlay");
      if (sidebarOverlay) {
        sidebarOverlay.classList.remove("show");
      }
    }
  });

  // Touch gestures for mobile
  let touchStartX = 0;
  let touchEndX = 0;

  document.addEventListener("touchstart", function(e) {
    touchStartX = e.changedTouches[0].screenX;
  });

  document.addEventListener("touchend", function(e) {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  });

  function handleSwipe() {
    const swipeThreshold = 50;
    const diff = touchStartX - touchEndX;

    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) {
        // Swipe left - show sidebar
        if (window.innerWidth <= 768) {
          const sidebar = document.getElementById("sidebar");
          if (sidebar) {
            sidebar.classList.add("show");
          }
          const sidebarOverlay = document.getElementById("sidebarOverlay");
          if (sidebarOverlay) {
            sidebarOverlay.classList.add("show");
          }
        }
      } else {
        // Swipe right - hide sidebar
        if (window.innerWidth <= 768) {
          const sidebar = document.getElementById("sidebar");
          if (sidebar) {
            sidebar.classList.remove("show");
          }
          const sidebarOverlay = document.getElementById("sidebarOverlay");
          if (sidebarOverlay) {
            sidebarOverlay.classList.remove("show");
          }
        }
      }
    }
  }

  // Initialize mobile menu when DOM is ready
  initializeMobileMenu();

  // Add event delegation for mobile menu button (in case it's loaded after script)
  document.addEventListener('click', function(e) {
    if (e.target.closest('#mobileMenuToggle')) {
      mobileMenuClickHandler(e);
    }
  });

  // Set up MutationObserver to watch for topbar changes
  const topbarContainer = document.getElementById("topbarContainer");
  if (topbarContainer) {
    const observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // Check if mobile menu toggle was added
          const mobileMenuToggle = document.getElementById("mobileMenuToggle");
          if (mobileMenuToggle) {
            // Re-initialize mobile menu functionality
            setTimeout(initializeMobileMenu, 100);
          }
        }
      });
    });

    observer.observe(topbarContainer, {
      childList: true,
      subtree: true
    });
  }

  // Also try to initialize after a short delay to catch async loading
  setTimeout(initializeMobileMenu, 500);
  setTimeout(initializeMobileMenu, 1000);
  setTimeout(initializeMobileMenu, 2000); // Additional attempt

  // Global utility functions
  window.showLoading = function() {
    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';
    spinner.innerHTML = '<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>';
    spinner.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255,255,255,0.8); display: flex; justify-content: center; align-items: center; z-index: 9999;';
    document.body.appendChild(spinner);
    return spinner;
  };

  window.hideLoading = function(spinner) {
    if (spinner && spinner.parentNode) {
      spinner.parentNode.removeChild(spinner);
    }
  };

  window.isMobile = function() {
    return window.innerWidth <= 576;
  };

  window.isTablet = function() {
    return window.innerWidth > 576 && window.innerWidth <= 768;
  };

  window.isDesktop = function() {
    return window.innerWidth > 768;
  };

  window.mobileAlert = function(message, type = "info") {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    alertDiv.style.cssText = 'top: 20px; left: 50%; transform: translateX(-50%); z-index: 9999; max-width: 90%;';
    alertDiv.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
      if (alertDiv.parentNode) {
        alertDiv.parentNode.removeChild(alertDiv);
      }
    }, 5000);
  };

  function initMobileFeatures() {
    // Add touch-friendly hover effects
    if ('ontouchstart' in window) {
      const touchElements = document.querySelectorAll('.btn, .nav-link, .card');
      touchElements.forEach(element => {
        element.addEventListener('touchstart', function() {
          this.style.transform = 'scale(0.98)';
        });
        element.addEventListener('touchend', function() {
          this.style.transform = '';
        });
      });
    }

    // Lazy loading for images
    const images = document.querySelectorAll('img[data-src]');
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.classList.remove('lazy');
          observer.unobserve(img);
        }
      });
    });

    images.forEach(img => imageObserver.observe(img));
  }

  initMobileFeatures();
});
