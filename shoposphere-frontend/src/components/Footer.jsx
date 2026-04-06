import { Link } from "react-router-dom";

export default function Footer() {
  const linkMap = {
    "Home": "/",
    "About Us": "/about",
    "Contact": "/contact",
    "Shop": "/categories",
    "New Arrivals": "/new",
  };

    return (
    <footer className="mt-14 bg-design-secondary border-t border-design">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-[1.4rem]">

        {/* Brand Section - Left Side */}
        <div className="">
          <div className="flex items-start gap-2">
            <img
              src="/logo.png"
              alt="shoposphere"
              className="h-[2.1rem] w-auto"
            />
            <div className="flex flex-col">
              <h3 className="font-display text-xs font-extrabold tracking-wide mb-0.5 text-design-foreground">
                shoposphere
              </h3>
              {/* Instagram Link */}
              <a
                href=""
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs transition-all duration-300 hover:translate-x-1 text-design-foreground hover:opacity-80"
              >
                
              </a>
            </div>
          </div>
        </div>

        {/* 2-Column Grid - Works on Mobile Too */}
        <div className="grid grid-cols-2 gap-1.5 md:gap-8 mb-2">

          {/* Quick Links - Left Side */}
          <div>
            <div className="space-y-1 text-xs">
              {Object.entries(linkMap).map(([label, path]) => (
                <Link
                  key={label}
                  to={path}
                  className="block transition-all duration-300 hover:translate-x-1 text-design-foreground hover:opacity-80"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {/* Connect With Us - Right Side */}
          <div>
            <h4 className="font-display font-bold mb-2 text-base text-design-foreground">Connect With Us</h4>

            <div className="space-y-1 text-xs text-design-foreground">
              <p className="flex items-start gap-2">
                <span className="mt-0.5">📍</span>
                <span></span>
              </p>
              <p className="flex items-center gap-2">
                <span>📱</span>
                <a 
                  href="tel:+917976948872" 
                  className="hover:underline transition-all duration-300 text-design-foreground hover:opacity-80"
                >
                  
                </a>
              </p>
              <p className="flex items-center gap-2">
                <span>📧</span>
                <a 
                  href="mailto:yashj.6628@gmail.com" 
                  className="hover:underline transition-all duration-300 text-design-foreground hover:opacity-80"
                >
                  
                </a>
              </p>
            </div>

            {/* Social Icons */}
            
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-design pt-4 flex flex-col md:flex-row justify-between items-center gap-3">
          <p className="text-xs text-design-foreground">
            © {new Date().getFullYear()} shoposphere. All rights reserved.
          </p>

          <div className="flex items-center gap-1.5 text-xs text-design-foreground">
            <span>Powered by</span>
            <a
              href="https://www.instagram.com/qyverra.it?igsh=MTV5a2pzdGNxNjIzdg=="
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold transition-all duration-300 hover:underline hover:opacity-80"
            >
              Qyverra
            </a>
          </div>
        </div>

      </div>
      </footer>
    );
  }
  