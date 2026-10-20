export default function Activity({ mode, children }) {
  const isVisible = mode === 'visible' || mode === true;
  return isVisible ? children : null;
}
