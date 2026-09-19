import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the session entry screen', () => {
  render(<App />);
  expect(screen.getByText(/Créer ou rejoindre une session/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Créer une session/i })).toBeInTheDocument();
});
