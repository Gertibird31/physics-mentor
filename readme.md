# Physics Mentor

A lightweight prototype for a Physics Mentor experience.

Current focus:
- Multi-course physics library (Physics 1, Physics 2, and more)
- Dedicated template page (currently Physics 1) with topic outlines and short descriptions
- Incremental rollout of interactive practice in future updates

## Email sign-in integration (Firebase)

This project now includes an email/password sign-in modal powered by Firebase Authentication REST APIs.

### Setup
1. Create a Firebase project and enable **Authentication → Sign-in method → Email/Password**.
2. Add a small config snippet before `script.js` on pages where you want auth enabled:

```html
<script>
  window.PHYSICS_MENTOR_AUTH = {
    firebaseApiKey: 'YOUR_FIREBASE_WEB_API_KEY'
  };
</script>
<script src="script.js"></script>
```

If no API key is supplied, the sign-in UI still appears but login/signup requests are disabled.
