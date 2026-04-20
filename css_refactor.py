import re

with open('styles.css', 'r', encoding='utf-8') as f:
    css = f.read()

# Define roots
new_roots = """
:root {
    --bg-body: #f5f5f7;
    --bg-panel: #ffffff;
    --bg-panel-light: #f5f5f7;
    --border-light: rgba(0, 0, 0, 0.08);
    --border-dark: transparent;
    --accent-blue: #0071e3;
    --accent-blue-dark: #0077ed;
    --accent-red: #ff3b30;
    --accent-gold: #f59e0b;
    --accent-green: #34c759;
    --text-primary: #1d1d1f;
    --text-muted: rgba(0, 0, 0, 0.56);
    --log-odd: #f5f5f7;
    --log-even: #ffffff;
    --system-message: #fdf6e3;
    
    --font-display: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif;
    --font-text: 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif;
    
    --shadow-card: rgba(0, 0, 0, 0.22) 3px 5px 30px 0px;
    --shadow-subtle: rgba(0, 0, 0, 0.08) 0px 2px 8px 0px;
    --nav-bg: rgba(255, 255, 255, 0.6);
    --nav-border: rgba(0,0,0,0.05);

    --font-size-base: 1rem;
    --font-size-small: 0.85rem;
    --font-size-xs: 0.75rem;
    --font-size-caption: 0.7rem;
    --font-size-label: 0.8rem;
    --font-size-heading: clamp(1.45rem, 2.8vw, 2.1rem);
    --font-size-subheading: clamp(1.1rem, 2.2vw, 1.35rem);
    --font-size-section: 0.95rem;
}

[data-theme="dark"] {
    --bg-body: #000000;
    --bg-panel: #1c1c1e;
    --bg-panel-light: #2c2c2e;
    --border-light: rgba(255, 255, 255, 0.15);
    --border-dark: transparent;
    --accent-blue: #0a84ff;
    --accent-blue-dark: #2997ff;
    --accent-red: #ff453a;
    --accent-gold: #ffd60a;
    --accent-green: #32d74b;
    --text-primary: #f5f5f7;
    --text-muted: rgba(255, 255, 255, 0.55);
    --log-odd: #2c2c2e;
    --log-even: #1c1c1e;
    --system-message: #3a3220;
    
    --shadow-card: rgba(0, 0, 0, 0.4) 3px 5px 30px 0px;
    --shadow-subtle: rgba(0, 0, 0, 0.15) 0px 2px 8px 0px;
    --nav-bg: rgba(28, 28, 30, 0.6);
    --nav-border: rgba(255,255,255,0.1);
}
"""

# Replace the :root block
css = re.sub(r':root\s*\{.*?\}(?=\s*\* \{)', new_roots, css, flags=re.DOTALL)

# Fonts & Baseline
css = re.sub(r"@font-face\s*\{[^\}]+\}", "", css, flags=re.DOTALL)
css = re.sub(r"image-rendering:\s*pixelated;", "", css)
css = re.sub(r"font-family:\s*'PixelFont'[^\;]+;", "font-family: var(--font-text); line-height: 1.47; letter-spacing: -0.011em;", css)

# Backgrounds
css = re.sub(r"background-image:[\s\S]+?repeating-linear-gradient[^\;]+;", "", css)

# Borders & Shadows
css = re.sub(r"border:\s*\d+px[^\;]+;", "border: 1px solid var(--border-light);", css)
css = re.sub(r"box-shadow:\s*inset[^;]+;", "", css) # Remove inner shadows
css = re.sub(r"box-shadow:\s*\d+px \d+px 0 [^\;]+;", "box-shadow: var(--shadow-card);", css)
css = re.sub(r"text-shadow:[^\;]+;", "", css)

# Headings to use SF Pro Display
css = re.sub(r"h1\s*\{", "h1 { font-family: var(--font-display); font-weight: 600; letter-spacing: -0.015em; ", css)
css = re.sub(r"h2\s*\{", "h2 { font-family: var(--font-display); font-weight: 600; letter-spacing: -0.015em; ", css)
css = re.sub(r"h3\s*\{", "h3 { font-family: var(--font-display); font-weight: 600; letter-spacing: -0.015em; ", css)

# Borders radius everywhere a card or input exists
components = ['.container', '.player-form', 'input', 'select', 'textarea', 'button', '.growth-lab', '.growth-panel', '.attribute-row', '.equipment-preview-item', '.player-info', '.summary-block', '.stat-tile', '.detail-entry', '.battle-result', '.battle-summary-trigger', '.log-line', '.log-round', '.battle-summary__panel', '.summary-section', '.summary-card']
for c in components:
    # insert border-radius
    css = re.sub(r"("+re.escape(c)+r"\s*\{[^}]+)(?=\})", r"\1 border-radius: 8px;", css, flags=re.DOTALL)

# Special buttons radius
css = re.sub(r"(button\s*\{[^}]+)(?=\})", r"\1 border-radius: 8px; border: none; font-weight: 400; padding: 10px 18px;", css, flags=re.DOTALL)
css = re.sub(r"(\.view-switcher__button\s*\{[^}]+)(?=\})", r"\1 border-radius: 980px; border: none;", css, flags=re.DOTALL)

# Custom injection for Apple Nav and Version Badge
apple_styles = """
.apple-nav {
  position: sticky;
  top: 16px;
  z-index: 1000;
  max-width: 980px;
  margin: 0 auto 24px auto;
  border-radius: 980px;
  background: var(--nav-bg);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  box-shadow: 0 4px 14px rgba(0,0,0,0.06);
  border: 1px solid var(--nav-border);
}

.apple-nav__logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 16px;
  color: var(--text-primary);
}

.apple-nav__links {
  display: flex;
  gap: 8px;
  align-items: center;
}

.apple-nav__actions .theme-toggle-btn {
  background: transparent;
  border: none;
  color: var(--text-primary);
  cursor: pointer;
  padding: 8px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: none;
  transition: background-color 0.2s;
}
.apple-nav__actions .theme-toggle-btn:hover {
  background: rgba(120, 120, 128, 0.12);
}
.view-switcher__button { border-radius: 980px; border: none; background: transparent; color: var(--text-muted); box-shadow: none; position: relative; padding: 6px 14px; font-size: 14px;}
.view-switcher__button:hover { background: rgba(120, 120, 128, 0.12); }
.view-switcher__button--active { background: transparent; box-shadow: none; color: var(--text-primary); font-weight: 600;}
.view-switcher__button--active::after { content: "•"; position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%); font-size: 12px; color: var(--text-primary); }

.version-badge {
    position: fixed;
    top: auto;
    bottom: 24px;
    right: 24px;
    background: transparent;
    border: none;
    padding: 0;
    box-shadow: none;
    font-size: 12px;
    color: var(--text-muted);
    letter-spacing: 0.5px;
    z-index: 1000;
}

h1 { display: none; } /* Hide old title */
.view-switcher { display: none; } /* Hide old view switcher if still around */
.apple-nav .view-switcher__button { display: inline-block; } 

"""
# Append custom styles
css = css + "\n" + apple_styles

with open('styles_migrated.css', 'w', encoding='utf-8') as f:
    f.write(css)

print("Migration script completed. Wrote to styles_migrated.css.")

# Fix health meter and ATB meter
css = re.sub(r"(\.health-meter__fill\s*\{[^}]+)(?=\})", r"\1 background: linear-gradient(90deg, #34c759, #32d74b); box-shadow: 0 0 8px rgba(52, 199, 89, 0.4); border-radius: 4px;", css, flags=re.DOTALL)
css = re.sub(r"(\.atb-meter__fill\s*\{[^}]+)(?=\})", r"\1 background: linear-gradient(90deg, #f59e0b, #ffd60a); box-shadow: 0 0 6px rgba(245, 158, 11, 0.4); border-radius: 2px;", css, flags=re.DOTALL)
css = re.sub(r"(\.health-meter__track\s*\{[^}]+)(?=\})", r"\1 border-radius: 4px;", css, flags=re.DOTALL)
css = re.sub(r"(\.atb-meter__track\s*\{[^}]+)(?=\})", r"\1 border-radius: 2px;", css, flags=re.DOTALL)
css = re.sub(r"(\.health-meter\[data-state='warning'\] \.health-meter__fill\s*\{[^}]+)(?=\})", r"\1 background: linear-gradient(90deg, #f59e0b, #ffd60a); box-shadow: 0 0 8px rgba(245, 158, 11, 0.4);", css, flags=re.DOTALL)
css = re.sub(r"(\.health-meter\[data-state='critical'\] \.health-meter__fill\s*\{[^}]+)(?=\})", r"\1 background: linear-gradient(90deg, #ff3b30, #ff453a); box-shadow: 0 0 8px rgba(255, 59, 48, 0.4);", css, flags=re.DOTALL)

with open('styles_migrated.css', 'w', encoding='utf-8') as f:
    f.write(css)
