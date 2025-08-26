# this doesn't do everything
# this overwrites dist/style.css and dist/index.js
npx @tailwindcss/cli -i src/style.css -o dist/style.css
npx webpack
