/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
  	extend: {
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			},
  			'wave1': {
  				'0%': { transform: 'translateY(0px) scaleY(1)' },
  				'25%': { transform: 'translateY(-8px) scaleY(1.05)' },
  				'50%': { transform: 'translateY(-16px) scaleY(0.95)' },
  				'75%': { transform: 'translateY(-8px) scaleY(1.05)' },
  				'100%': { transform: 'translateY(0px) scaleY(1)' }
  			},
  			'wave2': {
  				'0%': { transform: 'translateY(0px) scaleY(1)' },
  				'20%': { transform: 'translateY(12px) scaleY(0.98)' },
  				'40%': { transform: 'translateY(-6px) scaleY(1.02)' },
  				'60%': { transform: 'translateY(8px) scaleY(0.97)' },
  				'80%': { transform: 'translateY(-4px) scaleY(1.01)' },
  				'100%': { transform: 'translateY(0px) scaleY(1)' }
  			},
  			'bubble': {
  				'0%': { transform: 'translateY(-20px)', opacity: '0' },
  				'10%': { opacity: '0.5' },
  				'90%': { opacity: '0.5' },
  				'100%': { transform: 'translateY(-700px)', opacity: '0' }
  			},
  			'fadeInUp': {
  				'0%': { opacity: '0', transform: 'translateY(20px)' },
  				'100%': { opacity: '1', transform: 'translateY(0px)' }
  			},
  			'fadeInLeft': {
  				'0%': { opacity: '0', transform: 'translateX(-20px)' },
  				'100%': { opacity: '1', transform: 'translateX(0px)' }
  			},
  			'scaleIn': {
  				'0%': { transform: 'scale(0)' },
  				'100%': { transform: 'scale(1)' }
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'wave1': 'wave1 6s ease-in-out infinite',
  			'wave2': 'wave2 8s ease-in-out infinite',
  			'bubble': 'bubble 10s ease-out infinite',
  			'fadeInUp': 'fadeInUp 0.6s ease-out',
  			'fadeInLeft': 'fadeInLeft 0.8s ease-out',
			'scaleIn': 'scaleIn 0.5s ease-out 0.3s both'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
