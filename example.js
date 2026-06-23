import { getPosts, getProfile, getGroupInfo } from './index.js';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const BROWSERLESS_TOKEN = process.env.BROWSERLESS_TOKEN;

async function runDemo() {
  if (!BROWSERLESS_TOKEN) {
    console.error('ERROR: BROWSERLESS_TOKEN is not set in the environment or .env file.');
    console.log('Please copy .env.example to .env and fill in your token, or run:');
    console.log('  $env:BROWSERLESS_TOKEN="your_token_here" (PowerShell)');
    console.log('  export BROWSERLESS_TOKEN="your_token_here" (Bash)');
    return;
  }

  console.log('--- Facebook Scraper Library Demo ---\n');

  try {
    // 1. Scrape posts from Nintendo page
    console.log('Fetching posts from "nintendo" page...');
    const posts = await getPosts('nintendo', {
      pages: 1,
      browserlessToken: BROWSERLESS_TOKEN,
    });
    console.log(`Successfully fetched ${posts.length} posts.\n`);
    if (posts.length > 0) {
      console.log('First Post Preview:');
      console.log(JSON.stringify(posts[0], null, 2));
      console.log('----------------------------------------\n');
    }

    // 2. Scrape profile info for Mark Zuckerberg (zuck)
    console.log('Fetching profile about info for "zuck"...');
    const profile = await getProfile('zuck', {
      browserlessToken: BROWSERLESS_TOKEN,
    });
    console.log('Profile Preview:');
    console.log(JSON.stringify(profile, null, 2));
    console.log('----------------------------------------\n');

    // 3. Scrape group info for makeupartistsgroup
    console.log('Fetching group metadata for "makeupartistsgroup"...');
    const groupInfo = await getGroupInfo('makeupartistsgroup', {
      browserlessToken: BROWSERLESS_TOKEN,
    });
    console.log('Group Info Preview:');
    console.log(JSON.stringify(groupInfo, null, 2));
    console.log('----------------------------------------\n');

  } catch (error) {
    console.error('An error occurred during scraping:', error.message);
  }
}

runDemo();
