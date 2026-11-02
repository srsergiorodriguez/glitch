import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';

const target = document.getElementById('app');
if (!target) throw new Error('glitch: falta el nodo #app');

export default mount(App, { target });
