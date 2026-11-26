import { render } from 'preact';
import { App } from './components/App';
import { loadPropLabels } from './propLabels';
import './style.css';

function mount() {
  const container = document.getElementById('cc-devtools-root');
  if (container) {
    render(<App />, container);
  }
}

async function start() {
  await loadPropLabels();
  mount();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    void start();
  });
} else {
  void start();
}
