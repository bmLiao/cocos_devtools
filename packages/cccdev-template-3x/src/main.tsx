import { render } from 'preact';
import { App } from './components/App';
import './style.css';

// 等待 DOM 就緒後掛載
function mount() {
  const container = document.getElementById('cc-devtools-root');
  if (container) {
    render(<App />, container);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}
