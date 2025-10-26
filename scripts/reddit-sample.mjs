#!/usr/bin/env node

const subreddit = process.argv[2] || "lovable";
const limit = Number(process.argv[3]) || 5;

const url = new URL(`https://www.reddit.com/r/${subreddit}/top.json`);
url.searchParams.set("limit", String(limit));
url.searchParams.set("t", "week");

const headers = {
  "User-Agent": "LoopdLocalScraper/1.0 (https://github.com/loopd)"
};

async function run() {
  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`Reddit responded with ${response.status} ${response.statusText}`);
    }

    const payload = await response.json();
    const posts = payload?.data?.children ?? [];

    console.log(`Fetched ${posts.length} posts from r/${subreddit}`);
    console.log("---------------------------------------------");

    posts.forEach((entry, index) => {
      const post = entry?.data ?? {};
      console.log(`#${index + 1}: ${post.title}`);
      console.log(`   Author: u/${post.author}`);
      console.log(`   Score : ${post.score}`);
      console.log(`   Link  : https://reddit.com${post.permalink}`);
      console.log("");
    });
  } catch (error) {
    console.error("Failed to fetch subreddit:", error.message);
    process.exitCode = 1;
  }
}

run();
