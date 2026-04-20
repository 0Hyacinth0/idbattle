export function showFloatingText(containerDiv, text, type = 'damage') {
    if (!containerDiv) return;

    let fctContainer = containerDiv.querySelector('.fct-container');
    if (!fctContainer) {
        fctContainer = document.createElement('div');
        fctContainer.className = 'fct-container';
        containerDiv.style.position = 'relative'; // Ensure parent acts as anchor
        containerDiv.appendChild(fctContainer);
    }

    const textEl = document.createElement('div');
    textEl.className = `fct-text fct-text--${type}`;
    textEl.textContent = text;

    // Slight random spread on X axis for organic feel
    const randomOffset = (Math.random() - 0.5) * 40;
    textEl.style.left = `calc(50% + ${randomOffset}px)`;

    fctContainer.appendChild(textEl);

    // Remove text element after animation finishes
    const animationDuration = type === 'crit' ? 1500 : 1200;
    setTimeout(() => {
        if (textEl && textEl.parentNode) {
            textEl.parentNode.removeChild(textEl);
        }
    }, animationDuration);
}
