import { mount } from 'svelte'
import Panel from './Panel.svelte'
import '../lib/app.css'

mount(Panel, { target: document.getElementById('app')! })
