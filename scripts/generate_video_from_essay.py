
import os
import sys
import logging

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from admin.engineers.broadcaster import Broadcaster
from admin.config import config

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("VideoGenScript")

def main():
    slug = "the-return-of-personal-software"
    title = "The Return of Personal Software"
    content = """
There is a quiet revolution happening in the spaces between commercial software releases.

For the past thirty years, we've been trained to think of software as something that comes in shrink-wrapped boxes (or app stores, if you're under 40). Someone builds it. We buy it. We learn to work within its limitations. If it doesn't do what we need, we wait for version 2.0 or we switch to a competitor.

We became renters in someone else's digital house.

But something is shifting. The ability to build desktop apps—real, native applications—for personal use is no longer the domain of professional developers. It's becoming a basic literacy. And it's changing the way we think about what software *is for*.

## The Lost Vernacular

In the early days of personal computing, building your own software was common. Not because people were all programmers, but because the tools were simple enough and the problems were personal enough that tinkering was natural.

You didn't *buy* a spreadsheet to calculate your taxes. You opened VisiCalc or Lotus 1-2-3 and built the exact calculation you needed. You didn't buy project management software. You hacked together a HyperCard stack that worked the way *you* thought about projects.

There was a vernacular computing culture—people building small, weird, personal tools that solved their specific problems in their specific way.

Then software became an industry. Tools became products. Products became platforms. And the vernacular disappeared.

## The Shift

Today, the barriers to building personal software have collapsed in two ways:

**1. The tools are better.**  
Frameworks like Electron, Tauri, and Swift make it trivial to package a web interface into a native desktop app. You don't need to understand Windows APIs or Cocoa frameworks. If you can build a webpage, you can build an app.

**2. The intelligence is embedded.**  
AI-assisted development tools (like the one I used to build this blog) have made it possible to *describe* what you want and have most of the tedious work done for you. You become a director, not a typist.

The result: building a desktop app for personal use is now a weekend project, not a career.

## What Does "Personal Software" Look Like?

It's not trying to be for everyone. It's hyper-specific.

- A media organizer that works exactly the way *you* categorize things, not the way Apple Photos thinks you should.
- A note-taking app that mirrors your actual thought process, not someone's idea of "productivity."
- A budgeting tool that handles your weird financial situation (freelance income, crypto holdings, that one rental property) instead of forcing you into someone else's categories.

Personal software is **opinionated**. It reflects *your* preferences, *your* workflow, *your* aesthetics.

It doesn't need to scale. It doesn't need to onboard new users. It doesn't need a roadmap or a changelog.

It just needs to work for you.

## The Politics of Software Sovereignty

There's something subtly radical about building your own tools.

When you use commercial software, you are subject to its politics. The company decides what features matter. They decide when to deprecate old functionality. They decide whether to sell your data or raise the subscription price.

You are a guest.

When you build your own software, you are sovereign. You decide the features. You decide the lifespan. You own the data.

This isn't just a technical shift. It's a shift in power.

## The Invitation

You don't need to become a "developer" to participate in this. You just need to start thinking of software not as a product you consume, but as a material you shape.

Build a small tool. Make it ugly. Make it personal. Make it *yours*.

The desktop is not dead. It's just been waiting for you to remember that it belongs to you.
    """

    post_data = {
        "title": title,
        "slug": slug,
        "content": content
    }

    logger.info(f"Using Gemini Key: {config.GEMINI_API_KEY[:5]}..." if config.GEMINI_API_KEY else "No Gemini Key Found!")

    broadcaster = Broadcaster()
    logger.info(f"Generating video for: {title}")
    
    # Generate video (engine="moviepy" is default)
    # vibe="tech" might be appropriate for this topic
    video_path = broadcaster.generate_video(post_data, vibe="tech")
    
    if video_path:
        logger.info(f"Video generated successfully at: {video_path}")
    else:
        logger.error("Video generation failed.")

if __name__ == "__main__":
    main()
