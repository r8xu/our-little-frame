// Default text + sample milestones. Everything here is just a STARTING POINT:
// once the site is running, the ✏️ editor lets you change all of it.
window.OF = window.OF || {};

OF.DEFAULT_SETTINGS = {
  greeting: "Happy 23rd Birthday, My Love ♡",
  subtitle: "A little collection of everything we've been, everything we are, and everything we're going to be.",
  letter:
    "I wish I could put every hug, every memory, every little moment with you into a box. So I made you this instead. A little world of our own, filled with moments we've already lived and moments we're still waiting for.\n\n" +
    "Some are ready to be opened. Some need a little more time. And some haven't even been imagined yet.\n\n" +
    "Happy birthday, my favourite person. Here's to everything that's still waiting for us. ♡",
  future_letter: "",
  reunion_label: "",
  reunion_date: null
};

OF.CATEGORIES = [
  { title: "Little Things, Big Feelings", subtitle: "moments we've already lived" },
  { title: "Until I See You Again", subtitle: "for the miles between us" },
  { title: "Little Adventures", subtitle: "things we want to do together" },
  { title: "Building Our Little World", subtitle: "life, side by side" },
  { title: "One Day, My Love", subtitle: "the long, lovely road ahead" },
  { title: "The Things We Haven't Imagined Yet", subtitle: "to be decided by us" }
];

// [chapter, icon, title, hint, unlockMode, kind, message, extra]
// unlockMode: b=birthday(open now) d=date m=manual s=always sealed f=future surprise
const S = " [sample – edit me]";
OF.SAMPLE_MILESTONES = [
  [0, "✨", "The beginning of our story", "where it all started", "b", "memory", "Write the story of how we began here. The little details are the best part." + S],
  [0, "💬", "Our first conversation", "what we said, and what I felt", "b", "memory", "Write about our first conversation here." + S],
  [0, "🌟", "The moment I realised you were special", "I remember it exactly", "b", "letter", "Tell her the exact moment you knew." + S],
  [0, "📷", "Our first photo together", "frozen in time", "b", "photo", "Add a photo and a caption from the editor." + S],
  [0, "🧸", "Our favourite memory so far", "the one I replay the most", "b", "memory", "Describe your favourite memory so far." + S],
  [0, "⏳", "A moment I wish I could relive", "just once more", "b", "memory", "Which moment would you step back into?" + S],
  [0, "🌷", "A little thing you do that makes me happy", "you probably don't even notice", "b", "typewriter", "You do this tiny thing, and every time, it makes my whole day softer." + S],

  [1, "📮", "When you miss me", "open it on a hard day", "b", "letter", "A letter for the days when the distance feels loud." + S],
  [1, "✈️", "Our next reunion", "when we're finally in the same place", "m", "letter", "Write what you'll say when you see her." + S],
  [1, "🤗", "Our next hug", "the long one", "m", "typewriter", "I'm not letting go for at least a minute." + S],
  [1, "🥂", "Our next date together", "choose what we do", "m", "choice", "Pick one – I'll make it happen." + S, { options: ["A cosy dinner", "A long walk and ice cream", "A movie night in", "Surprise me"] }],
  [1, "🛬", "Our next airport goodbye", "it hurts, but it means we had time", "m", "letter", "Something to hold on to for the ride home." + S],
  [1, "😴", "The next time we fall asleep next to each other", "my favourite kind of quiet", "m", "memory", "A small wish for a sleepy night." + S],
  [1, "🧳", "Our first trip after a reunion", "somewhere new, together", "m", "promise", "A promise for our first trip after we meet again." + S],
  [1, "🗓️", "The day we stop counting days", "no more countdowns", "m", "letter", "What it will feel like to stop counting." + S],
  [1, "🛫", "The last airport goodbye", "the final one", "m", "letter", "Write something for the last goodbye." + S],
  [1, "🏡", "The day the distance finally ends", "unlocked by us, when it really happens", "m", "letter", "The letter for the day we are finally in the same place for good." + S],

  [2, "🎟️", "Pick something for us", "a coupon, just because", "b", "coupon", "One free pick for any day you like." + S, { coupon: "One date, planned entirely by me ♡" }],
  [2, "🗺️", "Our first big trip together", "pack light, bring snacks", "m", "promise", "Where do we go first? Write it here." + S],
  [2, "🌅", "Watching a sunrise together", "yes, we'll really wake up for it", "m", "memory", "Sunrise wishes." + S],
  [2, "🚗", "A spontaneous road trip", "no plan, just a playlist", "m", "promise", "Road trip rules: snacks first." + S],
  [2, "🎶", "Our first concert together", "singing way too loudly", "m", "memory", "Whose concert should it be?" + S],
  [2, "🍝", "Cooking a new dish together", "we will make a mess", "m", "choice", "Pick one to cook." + S, { options: ["Fresh pasta", "Dumplings", "Something spicy", "A dessert disaster"] }],
  [2, "🎲", "A completely unplanned date", "wherever the day takes us", "m", "promise", "No plans. Just you and me." + S],
  [2, "🏔️", "Visiting a place we've always wanted to see", "the one on the list", "m", "promise", "Write the place here." + S],
  [2, "📸", "A trip where we take too many pictures", "camera roll: full", "m", "memory", "Too many pictures is never too many." + S],
  [2, "📵", "A day with no phones, just us", "a whole day, only us", "m", "promise", "A promise of a day offline." + S],

  [3, "🔑", "Our first home together", "the key to everything", "m", "letter", "Write about the first time we walk in." + S],
  [3, "🍳", "Our first meal in our own kitchen", "burnt toast counts", "m", "memory", "Our first kitchen." + S],
  [3, "🪴", "Buying something for our home", "something small, something ours", "m", "promise", "A small thing for our space." + S],
  [3, "🐾", "A pet, if we choose to", "only if we both want it, in our own time", "m", "promise", "Totally optional. Only if and when we decide." + S],
  [3, "🎄", "Our first Christmas together", "twinkly lights and warm socks", "m", "memory", "Our first Christmas." + S],
  [3, "🎆", "Our first New Year's together", "midnight, but make it us", "m", "memory", "Our first New Year." + S],
  [3, "👨‍👩‍👧", "Celebrating with each other's families", "a table full of people we love", "m", "letter", "Family dinners." + S],
  [3, "🧗", "The first big challenge we overcome", "because we will", "m", "letter", "A letter for a hard moment." + S],

  [4, "🎂", "Turning 25", "another year of you", "m", "letter", "A letter for your 25th." + S],
  [4, "💞", "Five years together", "five whole years", "m", "letter", "Five years." + S],
  [4, "🎈", "Turning 30", "thirty and thriving", "m", "letter", "A letter for your 30th." + S],
  [4, "🌳", "Ten years together", "a decade of us", "m", "letter", "Ten years." + S],
  [4, "💍", "Getting engaged", "only when it's real", "s", "letter", "The letter for the day we get engaged." + S],
  [4, "👰", "Our wedding day", "a day that belongs to us", "s", "letter", "The letter for our wedding day." + S],
  [4, "🥂", "Our first anniversary as a married couple", "year one, officially", "s", "letter", "Our first wedding anniversary." + S],
  [4, "🪑", "Growing old together", "slowly, happily", "s", "letter", "Growing old with you is my favourite plan." + S],
  [4, "🕰️", "Looking back at this website years from now", "hello from the past", "m", "capsule", "Hello, future us. This is what we were like." + S],
  [4, "💌", "A letter to us, 20 years from now", "time capsule", "m", "capsule", "Dear us, twenty years from now." + S],

  [5, "❔", "Something wonderful we haven't planned yet", "to be continued", "f", "letter", ""],
  [5, "🌠", "Our next big adventure", "we'll know when we know", "f", "letter", ""],
  [5, "🎁", "A surprise from future us", "future us has plans", "f", "letter", ""],
  [5, "🤍", "We don't know yet, and that's the fun part", "mystery", "f", "letter", ""],
  [5, "🧩", "To be decided by us", "we decide, together", "f", "letter", ""],
  [5, "🔮", "One day, we'll know", "someday", "f", "letter", ""]
];

OF.SAMPLE_NOTES = [
  { kind: "love_note", body: "You're my favourite person to think about on a quiet afternoon. ♡" },
  { kind: "love_note", body: "I love you more than the distance can hide. ♡" },
  { kind: "love_note", body: "Whatever today looked like, you're doing wonderfully. I'm so proud of you." },
  { kind: "date_idea", body: "Cook the same recipe on a video call and compare the results" },
  { kind: "date_idea", body: "Watch a film at the same time, with the same snacks" },
  { kind: "date_idea", body: "A slow walk with no destination" }
];
