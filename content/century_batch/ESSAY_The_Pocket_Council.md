---
title: "The Pocket Council: Managing 10 Agents on 5 Inches"
date: 2025-12-19
category: Mobile_Agency
tags: [UI, Design, Mobile]
---

# Screen Real Estate Scarcity

On a 27-inch monitor, you can have 5 windows open. You can see the Swarm working in parallel.
On an iPhone, you have 5 inches.
How do you visualize a 10-agent debate?

## The Stack Interaction
We treat agents as a deck of cards.
*   **Top Card**: The active speaker.
*   **Background Cards**: Agents listening or thinking.
When the **Guardian** interrupts the **Architect**, the Guardian's card slides to the front.

## Avatar Minimalism
We replaced text names with distinct abstract avatars/colors.
*   Architect: Blue Structure.
*   Guardian: Red Shield.
*   Writer: Yellow Pen.
You recognize the *color* before you read the name. "Red means stop."

## Threading
We thread sub-conversations.
If the Architect and Engineer need to "take it offline" to debug a script, they spawn a sub-thread. The main feed remains clean.
You can tap the thread to "inspect" their work, or ignore it until they return with a result.
