'use client'
import { useEffect } from 'react'

export default function ScriptLoader() {
  useEffect(() => {
    const scripts = [
      "/assets/vendor/bootstrap/js/bootstrap.bundle.min.js",
      "/assets/vendor/php-email-form/validate.js",
      "/assets/vendor/aos/aos.js",
      "/assets/vendor/glightbox/js/glightbox.min.js",
      "/assets/vendor/purecounter/purecounter_vanilla.js",
      "/assets/vendor/swiper/swiper-bundle.min.js",
      "/assets/js/main.js"
    ]

    scripts.forEach(src => {
      if (document.querySelector(`script[src="${src}"]`)) return
      
      const script = document.createElement('script')
      script.src = src
      // Setting async = false guarantees scripts are executed in the exact order they are appended!
      script.async = false 
      document.body.appendChild(script)
    })
  }, [])

  return null
}
