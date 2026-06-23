import { getPostComments, getPosts, getProfile } from "./index.js";

console.log(
    await getPostComments("https://www.facebook.com/permalink.php?story_fbid=pfbid0FsnVYwtNQGCZF3eZ8TcF3ojt6fAbCyc795nb2yVfcye8BetHv7uSok6SYgE9gEMil&id=100070996121762&rdid=87gr19zJ3tjEWT9T#", {
        maxComments: 100,
        browserlessToken: "2UjPvCmUGz0PWSW60b88ffdfb4af0bc5105bbe77c0d911fb9",
        cookies: { file: "cookies.txt" }
    })
)

