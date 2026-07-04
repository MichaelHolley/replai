import { mount } from 'svelte'
import Onboarding from './Onboarding.svelte'
import '../lib/app.css'

mount(Onboarding, { target: document.getElementById('app')! })
