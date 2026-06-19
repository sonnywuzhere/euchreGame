export type Track = {
  title: string;
  src: string;
};

// Drop MP3 files into client/public/music/ and add an entry here.
export const tracks: Track[] = [
  // { title: 'Song Name', src: '/music/filename.mp3' },
  {title: "High Stakes, Low Voices", src: "/music/High Stakes, Low Voices.mp3"},
  {title: "Mahogany Cardroom", src: "/music/Mahogany Cardroom.mp3"},
  {title: "Smoky Euchre Lounge", src: "/music/Smoky Euchre Lounge.mp3"},
  {title: "Velvet Card Table", src: "/music/Velvet Card Table.mp3"}
];
