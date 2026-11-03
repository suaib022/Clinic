#!/usr/bin/env python3
"""
Labaid Hospital Knowledge Base Scraper
Crawls all important URLs specified in labaid_hospital_sitemap.json,
filters out doctor profile cards/consultant blocks, extracts clean markdown text,
and saves individual markdown files ready for Voiceflow/LLM KB ingestion.
"""

import os
import re
import ssl
import json
import time
import urllib.request
from bs4 import BeautifulSoup

SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

OUTPUT_DIR = '/Users/nihad/Bot_voice_chat/kb_scraped_data'

def clean_soup(soup):
    # Remove script, style, nav, footer, header
    for tag in soup(['script', 'style', 'noscript', 'header', 'footer', 'nav']):
        tag.decompose()

    # Specifically filter out doctor listings, consultant sections as requested
    for selector in ['.doctor-item', '.doctor-card', '.consultants-section', '.consultant-card', '#doctor', '.doc-item']:
        for el in soup.select(selector):
            el.decompose()

    # Remove consultant headings and following consultant list
    for h in soup.find_all(['h3', 'h4', 'h5']):
        text = h.get_text().strip().lower()
        if 'consultant' in text or 'leading doctor' in text or 'doctor list' in text:
            # check parent or sibling
            parent = h.find_parent('div')
            if parent and ('consultant' in parent.get('class', []) or 'doctor' in parent.get('class', [])):
                parent.decompose()
            else:
                h.decompose()

    return soup

def fetch_and_clean(url):
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        html = urllib.request.urlopen(req, context=SSL_CTX, timeout=20).read().decode('utf-8', errors='ignore')
        soup = BeautifulSoup(html, 'html.parser')
        
        title = soup.title.string.strip() if soup.title else url

        # Find main content container
        main = soup.find('main') or soup.find('article') or soup.find('body')
        if not main:
            return None

        main = clean_soup(main)
        
        # Extract text in structured format
        lines = []
        lines.append(f"# {title}\n")
        lines.append(f"> Source: {url}\n\n")

        for el in main.find_all(['h1', 'h2', 'h3', 'h4', 'p', 'ul', 'ol', 'table']):
            if el.name in ['h1', 'h2']:
                txt = el.get_text(strip=True)
                if txt:
                    lines.append(f"\n## {txt}\n")
            elif el.name in ['h3', 'h4']:
                txt = el.get_text(strip=True)
                if txt:
                    lines.append(f"\n### {txt}\n")
            elif el.name == 'p':
                txt = el.get_text(strip=True)
                if txt and len(txt) > 5:
                    lines.append(f"{txt}\n")
            elif el.name in ['ul', 'ol']:
                items = [li.get_text(strip=True) for li in el.find_all('li') if li.get_text(strip=True)]
                if items:
                    for item in items:
                        lines.append(f"- {item}")
                    lines.append("")
            elif el.name == 'table':
                # Convert table rows
                for row in el.find_all('tr'):
                    cols = [td.get_text(strip=True) for td in row.find_all(['td', 'th'])]
                    if cols:
                        lines.append(" | ".join(cols))
                lines.append("")

        content = "\n".join(lines)
        # Deduplicate extra blank lines
        content = re.sub(r'\n{3,}', '\n\n', content)
        return content.strip()
    except Exception as e:
        print(f"Failed to fetch {url}: {e}")
        return None

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open('/Users/nihad/Bot_voice_chat/labaid_hospital_sitemap.json') as f:
        sitemap = json.load(f)

    categories = sitemap['categories']
    count = 0
    total = sitemap['total_links']

    for cat_name, items in categories.items():
        cat_dir = os.path.join(OUTPUT_DIR, cat_name)
        os.makedirs(cat_dir, exist_ok=True)
        print(f"\n=== Processing Category: {cat_name} ({len(items)} items) ===")

        for item in items:
            url = item.get('url')
            if not url or url.startswith('tel:') or '103.228.38.10' in url:
                continue

            slug = url.rstrip('/').split('/')[-1]
            if not slug or slug == 'en' or slug.startswith('http'):
                slug = item.get('name', 'index').lower().replace(' ', '_')
            
            filename = f"{slug}.md"
            filepath = os.path.join(cat_dir, filename)

            if os.path.exists(filepath):
                print(f"Skipping already scraped: {filename}")
                continue

            print(f"Scraping [{count+1}/{total}]: {url} -> {filename}")
            content = fetch_and_clean(url)
            if content and len(content) > 50:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(content)
            time.sleep(0.5)
            count += 1

    print("\nScraping complete! Files saved to:", OUTPUT_DIR)

if __name__ == '__main__':
    main()
