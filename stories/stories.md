as a user, I want to create a public vote
as a user, I want to see public votes

as a user, i want to be able to create a vote with a title, a description, type (public, unlisted, private), a system (approval, majority judgment) and a list of options. the options should be validated to be unique, and not empty. the title should be validated to be not empty. at least 2 options are required. adding a new vote should be automatic after pressing enter on the last option text field, or clicking on a button, a remove button should be available as long as there at least more than 2 options. i want to be able to create a vote by approval, or by judgment. with a radio button, default on nothing, but it's mandatory, during the selection, a very short description in italic will explain in which circustance this voting system is the best to use, indicating the approval focus on simplicity, and the judgment focus on quality.

as a user, I want to create a unlisted vote, with a unique id/token impossible to guess, that only selected people will have through a link. The link should be shareable, ideally short to ease with reading (maybe encode using letter, lowercase, uppercase, and simple simple allowed in url)

as a user, I want to see the votes I created, public, private, unlisted

as a user, I want to create private vote, with a unique id/token impossible to guess, that only selected people will have through a link. And only the selected people will be able to see the vote, and vote on it.

as a user, I want to see my votes list by their names and the number of voters : if more than 10, I want to be able to scroll through them. if there is a limit known of participants, I want to see it after the number of participants like this : (4/7). the list should be separated from the public list of votes, and sorted from the more recent to the older

as a user, I want to see the details of a vote when I click on it

as a user, I want to vote on an option when I click on it.

as a user, I want to see a QR code to share the vote with others

as a user , I want to be able to remove my votes all together on vote, my participation will be removed, the number of participant will be reduced, my choices will be removed from the database

as a user, I want to see public votes in my local area, with a variable radius, client and server side, minimal radius should be 1km. client side maximal radius should be 100km, default should be 10km. the localisation should be store in the database at creation if user allow it. user will have a map to see where to place the vote at creation.

as a user, I want to see public votes in my languages only, with the possibility to change the language of the votes.

as a user, I want to see the public votes of my country, with the possibility to change the country using a dropdown, with default country being the country of the user. country of the user should be stored in the database at creation if user allow it.

as a user, I want to see the public votes made by people of my country and votes publicly localized in my country, with the possibility to change the country using a dropdown, with default country being the country of the user. country of the user should be stored in the database at creation if user allow it.

as a user, I want to see the voting count of each option of a vote only for approval voting. both in voting mode and view mode. with live update in voting mode

as a user, I want to see the majority judgement graph for each option of a vote only for majority judgement voting. both in voting mode and view mode.with live update in voting mode.
