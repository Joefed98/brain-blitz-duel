exec(open('/home/claude/art/comp.py').read())
# Joulz icon set: 24 grid, 2 px stroke, mitred corners, one angled cut per shape, bolt accents
S="fill='none' stroke='currentColor' stroke-width='2' stroke-linejoin='round' stroke-linecap='round'"
BOLT_SM="M12.6 10.2 10 14h2l-.6 3 2.6-3.8h-2z"
ICN={
'play': f"<path {S} d='M14.5 1.5 7.5 13h4.5L10 22.5 17 10.5h-4.5z'></path>",
'play_on': "<path fill='currentColor' stroke='currentColor' stroke-width='2' stroke-linejoin='round' d='M14.5 1.5 7.5 13h4.5L10 22.5 17 10.5h-4.5z'></path>",
'practice': f"<circle {S} cx='12' cy='12' r='9'></circle><circle {S} cx='12' cy='12' r='5'></circle><circle cx='12' cy='12' r='1.6' fill='currentColor'></circle>",
'practice_on': f"<circle {S} cx='12' cy='12' r='9'></circle><circle cx='12' cy='12' r='5.5' fill='currentColor'></circle>",
'tournaments': f"<path {S} d='M7 4h10v5a5 5 0 0 1-10 0z'></path><path {S} d='M7 6H4.5v1.5A3.5 3.5 0 0 0 7.5 11M17 6h2.5v1.5A3.5 3.5 0 0 1 16.5 11'></path><path {S} d='M12 14v3.5M8.5 20.5h7'></path>",
'tournaments_on': f"<path fill='currentColor' d='M6 3h12v6a6 6 0 0 1-12 0z'></path><path {S} d='M6.5 6H4.5v1.5A3.5 3.5 0 0 0 7.5 11M17.5 6h2v1.5A3.5 3.5 0 0 1 16.5 11'></path><path {S} d='M12 15v3M8.5 20.5h7'></path>",
'profile': f"<path {S} d='M5.5 11.5C5.5 6.5 8.4 3.5 12 3.5s6.5 3 6.5 8c0 3.6-2.6 5.6-6.5 6.5-3.9-.9-6.5-2.9-6.5-6.5z'></path><path fill='currentColor' d='M7.3 8.6h9.4v2.4L13.2 12.3 12 13.7 10.8 12.3 7.3 11z'></path><path {S} d='M5 21.5c1.6-1.4 4.1-2.2 7-2.2s5.4.8 7 2.2'></path>",
'profile_on': "<path fill='currentColor' fill-rule='evenodd' d='M5.5 11.5C5.5 6.5 8.4 3.5 12 3.5s6.5 3 6.5 8c0 3.6-2.6 5.6-6.5 6.5-3.9-.9-6.5-2.9-6.5-6.5z M7.3 8.6h9.4v2.4L13.2 12.3 12 13.7 10.8 12.3 7.3 11z'></path><path fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' d='M5 21.5c1.6-1.4 4.1-2.2 7-2.2s5.4.8 7 2.2'></path>",
'sound': f"<path {S} d='M4 9.5h3.5L12 5.5v13l-4.5-4H4z'></path><path {S} d='M15.5 9.5a3.5 3.5 0 0 1 0 5M18 7a7 7 0 0 1 0 10'></path>",
'music': f"<path {S} d='M9 17.5V5.5l10-2v12'></path><circle {S} cx='6.5' cy='17.5' r='2.5'></circle><circle {S} cx='16.5' cy='15.5' r='2.5'></circle>",
'menu': "<circle cx='12' cy='5' r='1.8' fill='currentColor'></circle><circle cx='12' cy='12' r='1.8' fill='currentColor'></circle><circle cx='12' cy='19' r='1.8' fill='currentColor'></circle>",
'settings': f"<path {S} d='M10.19 2.67 L13.81 2.67 L14.13 5.02 L15.43 5.55 L17.31 4.12 L19.88 6.69 L18.45 8.57 L18.98 9.87 L21.33 10.19 L21.33 13.81 L18.98 14.13 L18.45 15.43 L19.88 17.31 L17.31 19.88 L15.43 18.45 L14.13 18.98 L13.81 21.33 L10.19 21.33 L9.87 18.98 L8.57 18.45 L6.69 19.88 L4.12 17.31 L5.55 15.43 L5.02 14.13 L2.67 13.81 L2.67 10.19 L5.02 9.87 L5.55 8.57 L4.12 6.69 L6.69 4.12 L8.57 5.55 L9.87 5.02 Z'></path><circle {S} cx='12' cy='12' r='3'></circle>",
'chat': f"<path {S} d='M4 5h16v11H11l-5 4v-4H4z'></path><path {S} d='M8.5 9.5h7M8.5 12.5h4.5'></path>",
'share': f"<path {S} d='M12 3.5v11M8 7.5l4-4 4 4'></path><path {S} d='M5.5 11.5v8h13v-8'></path>",
'back': f"<path {S} d='M15 5 8 12l7 7'></path>",
'close': f"<path {S} d='M6.5 6.5l11 11M17.5 6.5l-11 11'></path>",
'help': f"<circle {S} cx='12' cy='12' r='9'></circle><path {S} d='M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.5v.4'></path><circle cx='12' cy='16.8' r='1.1' fill='currentColor'></circle>",
'calendar': f"<rect {S} x='4' y='5.5' width='16' height='15' rx='2'></rect><path {S} d='M4 10h16M8.5 3.5v4M15.5 3.5v4'></path><path fill='currentColor' d='{BOLT_SM}'></path>",
'lock': f"<rect {S} x='5' y='10.5' width='14' height='10' rx='2'></rect><path {S} d='M8 10.5V8a4 4 0 0 1 8 0v2.5'></path>",
'search': f"<circle {S} cx='10.5' cy='10.5' r='6.5'></circle><path {S} d='M15.5 15.5l5 5'></path>",
'link': f"<path {S} d='M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1'></path><path {S} d='M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'></path>",
'addfriend': f"<path {S} d='M3 12C3 7.9 5.4 5.5 8.5 5.5S14 7.9 14 12c0 2.9-2.1 4.6-5.5 5.4C5.1 16.6 3 14.9 3 12z'></path><path fill='currentColor' d='M4.8 9.5h7.4v1.9L9.4 12.5l-.9 1.1-.9-1.1-2.8-1.1z'></path><path {S} d='M2.5 21.5c1.5-1.2 3.6-1.9 6-1.9s4.5.7 6 1.9M19 6v6M16 9h6'></path>",
'friends': f"<path {S} d='M14.5 5.2C15.3 4.6 16.3 4.3 17.3 4.3c2.6 0 4.7 2 4.7 5.6 0 2.6-1.8 4.1-4.7 4.8'></path><path {S} d='M3 12.5C3 8.4 5.4 6 8.5 6S14 8.4 14 12.5c0 2.9-2.1 4.6-5.5 5.4C5.1 17.1 3 15.4 3 12.5z'></path><path fill='currentColor' d='M4.8 10h7.4v1.9L9.4 13l-.9 1.1-.9-1.1-2.8-1.1z'></path><path {S} d='M2.5 21.5c1.5-1.2 3.6-1.9 6-1.9s4.5.7 6 1.9M16.5 18.5c2 .2 3.7.9 5 2'></path>",
'timer': f"<circle {S} cx='12' cy='13.5' r='7.5'></circle><path {S} d='M12 9.5v4l2.5 2M9.5 2.5h5M12 2.5V6'></path>",
'shop': f"<path {S} d='M5 8h14l-1 12.5H6z'></path><path {S} d='M9 8V6.5a3 3 0 0 1 6 0V8'></path><path fill='currentColor' d='M12.6 11.2 10 15h2l-.6 3 2.6-3.8h-2z'></path>",
'check': f"<path {S} d='M5 12.5l4.5 4.5L19 7.5'></path>",
'cross': f"<circle {S} cx='12' cy='12' r='9'></circle><path {S} d='M9 9l6 6M15 9l-6 6'></path>",
'up': "<path fill='currentColor' stroke='currentColor' stroke-width='1.5' stroke-linejoin='round' d='M12 6 19 17H5z'></path>",
'down': "<path fill='currentColor' stroke='currentColor' stroke-width='1.5' stroke-linejoin='round' d='M12 18 5 7h14z'></path>",
'star': "<path fill='currentColor' stroke='currentColor' stroke-width='1.5' stroke-linejoin='round' d='M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5 6.6 19.5l1.2-6-4.5-4.2 6.1-.7z'></path>",
}

ICN.update({
'sound_off': f"<path {S} d='M4 9.5h3.5L12 5.5v13l-4.5-4H4z'></path><path {S} d='M16 9.5l5 5M21 9.5l-5 5'></path>",
'music_off': f"<path {S} d='M9 17.5V5.5l10-2v12'></path><circle {S} cx='6.5' cy='17.5' r='2.5'></circle><circle {S} cx='16.5' cy='15.5' r='2.5'></circle><path {S} d='M3 3l18 18'></path>",
'rematch': f"<path {S} d='M19.5 9.5A8 8 0 0 0 5.4 7.4M4.5 14.5a8 8 0 0 0 14.1 2.1'></path><path {S} d='M5 3.5v4h4M19 20.5v-4h-4'></path>",
'edit': f"<path {S} d='M15.5 4.5l4 4L9 19H5v-4z'></path><path {S} d='M13 7l4 4'></path>",
'streak': f"<path {S} d='M12 21.5c-3.9 0-6.5-2.6-6.5-6.2 0-3.6 2.6-5.6 3.8-8.8 1.4 1.4 2 3 2 4.6 1.2-1 2-2.6 2-4.6 2.8 2 5.2 5.2 5.2 8.8 0 3.6-2.6 6.2-6.5 6.2z'></path><path {S} d='M12 21.5c-1.6 0-2.7-1.1-2.7-2.6 0-1.8 1.6-2.7 2.7-4.4 1.1 1.7 2.7 2.6 2.7 4.4 0 1.5-1.1 2.6-2.7 2.6z'></path>",
'leaderboard': f"<path {S} d='M9 20.5V8.5h6v12M3.5 20.5v-7H9M15 20.5v-9.5h5.5v9.5M2.5 20.5h19'></path><path fill='currentColor' d='M12.4 2.8 10.8 5.2h1.2l-.4 1.9 1.6-2.4H12z'></path>",
'rewards': f"<rect {S} x='3.5' y='8.5' width='17' height='4' rx='1'></rect><path {S} d='M5 12.5v8h14v-8M12 8.5v12'></path><path {S} d='M12 8.5C10.5 5 7 4.5 7 6.5S10 8.5 12 8.5zM12 8.5c1.5-3.5 5-4 5-2s-3 2-5 2z'></path>",
'notifications': f"<path {S} d='M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z'></path><path {S} d='M10 21h4'></path>",
'info': f"<circle {S} cx='12' cy='12' r='9'></circle><path {S} d='M12 11v5.5'></path><circle cx='12' cy='7.6' r='1.2' fill='currentColor'></circle>",
'filter': f"<path {S} d='M4 6.5h16M7 12h10M10 17.5h4'></path>",
})
NAMES=[('play','Play'),('practice','Practice'),('tournaments','Tournaments'),('profile','Profile'),('friends','Friends'),('addfriend','Add friend'),
       ('sound','Sound'),('sound_off','Sound off'),('music','Music'),('music_off','Music off'),('menu','Game menu'),('settings','Settings'),
       ('chat','Chat'),('share','Share'),('link','Copy link'),('back','Back'),('close','Close'),('help','How to play'),
       ('rematch','Rematch'),('edit','Edit'),('search','Search'),('filter','Filter'),('info','Info'),('notifications','Notifications'),
       ('calendar','Calendar'),('timer','Timer'),('lock','Locked'),('shop','Shop'),('rewards','Rewards'),('leaderboard','Leaderboard'),
       ('streak','Streak'),('star','Star'),('check','Done'),('cross','Wrong'),('up','Up'),('down','Down')]
def ic(k,px=24,col=T):
    return f"<svg width='{px}' height='{px}' viewBox='0 0 24 24' aria-hidden='true' style='color: {col}; flex-shrink: 0'>{ICN[k]}</svg>"
