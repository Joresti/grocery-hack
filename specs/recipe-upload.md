Feature: Upload Custom Recipe

Scenario: User accesses recipe upload
Given the user is on the landing page
When the user clicks "Add a Recipe"
Then a recipe creation form should open

Scenario: User creates recipe manually
Given the recipe creation form is open
When the user enters a recipe name
And adds one or more ingredients with quantities
Then the "Save Recipe" button should become active

Scenario: User adds optional recipe details
Given the recipe creation form is open
Then the user should be able to optionally enter:
  | field            |
  | prep time        |
  | cook time        |
  | servings         |
  | steps            |
  | dietary tags     |
  | notes            |

Scenario: User saves a custom recipe
Given the user has entered a recipe name
And at least one ingredient
When the user clicks "Save Recipe"
Then the recipe should be saved to the database
And the recipe source should be marked as "user"
And the recipe should be linked to the user's account
And the user should see a confirmation message


Feature: Import Recipe from URL

Scenario: User pastes a recipe URL
Given the recipe creation form is open
When the user pastes a URL from a recipe website
And clicks "Import"
Then the system should fetch the page content
And extract the recipe name, ingredients, and steps

Scenario: Import succeeds
Given the system successfully extracts the recipe
Then the form should auto-populate with:
  | field       |
  | recipe name |
  | ingredients |
  | steps       |
And the user should be able to review and edit before saving

Scenario: Import fails
Given the system cannot extract a recipe from the URL
Then the user should see a message: "We couldn't read that recipe — try adding it manually"
And the manual entry form should remain available


Feature: User Recipe Ingredient Matching

Scenario: System extracts key ingredients
Given a user has saved a custom recipe
Then the system should extract and normalize ingredient keywords
And classify each ingredient by estimated cost tier:
  | tier    | examples                              |
  | staple  | rice, onion, garlic, canned beans     |
  | mid     | chicken breast, salmon, bell peppers  |
  | premium | beef tenderloin, lamb rack, lobster   |

Scenario: System identifies cost-driving ingredients
Given the ingredients have been classified
Then the system should flag ingredients in the mid and premium tiers as cost drivers
And cost drivers should be the primary trigger for deal notifications


Feature: Recipe Deal Notifications

Scenario: Single cost-driving ingredient goes on sale
Given a user has a saved recipe with cost-driving ingredients
And one cost-driving ingredient appears in this week's deals at a nearby store
Then the system should not notify the user
And the match should be stored silently for future reference

Scenario: Multiple cost-driving ingredients go on sale
Given a user has a saved recipe with cost-driving ingredients
And two or more cost-driving ingredients appear in this week's deals at nearby stores
Then the system should notify the user via push notification and/or email
And the notification should include:
  | element                                   |
  | recipe name                               |
  | which ingredients are on sale              |
  | which stores have the deals               |
  | estimated total cost vs regular cost       |

Scenario: Notification message format
Given the notification criteria are met
Then the notification should read similar to:
  "Your Beef Wellington just got affordable — beef tenderloin is $12.99/lb and mushrooms are 40% off at PriceRight this week"

Scenario: Cost threshold notification
Given a user has a saved recipe
And the combined deal prices reduce the total recipe cost by 30% or more compared to regular prices
Then the system should notify the user regardless of how many ingredients triggered it
And the notification should highlight the total savings


Feature: Recipe Deal Display on Landing Page

Scenario: User recipe matches current deals
Given the user has saved recipes
And one or more recipes match this week's deals
Then a "Your Recipes on Sale" section should appear on the landing page
And it should appear between the Absurd Deal Alert and Dream Meal Matching sections

Scenario: Display recipe deal card
Given a user recipe matches current deals
Then the recipe deal card should display:
  | element                        |
  | recipe name                    |
  | number of ingredients on sale  |
  | estimated cost this week       |
  | estimated regular cost         |
  | savings amount                 |

Scenario: User taps recipe deal card
Given a recipe deal card is displayed
When the user taps the card
Then the full recipe should open in a modal
And ingredients on sale should be highlighted with deal prices
And non-sale ingredients should be styled as pantry items

Scenario: No user recipes match deals
Given the user has saved recipes
And none match this week's deals
Then the "Your Recipes on Sale" section should not appear


Feature: User Recipe Management

Scenario: User views saved recipes
Given the user has saved one or more recipes
When the user navigates to their recipe collection
Then all saved recipes should be listed
And each recipe should show:
  | element              |
  | recipe name          |
  | number of ingredients|
  | source (manual / imported) |
  | date added           |

Scenario: User edits a saved recipe
Given the user is viewing their recipe collection
When the user taps a recipe
Then the recipe detail should open
And the user should be able to edit any field
And save changes

Scenario: User deletes a saved recipe
Given the user is viewing a recipe detail
When the user taps "Delete Recipe"
Then a confirmation prompt should appear
When the user confirms deletion
Then the recipe should be removed
And any associated deal notifications should stop


Feature: Recipe Taste Profile Integration

Scenario: Uploaded recipe feeds taste profile
Given a user saves a custom recipe
Then the system should extract taste tags from the recipe:
  | tag type       | example value         |
  | protein        | beef                  |
  | cuisine        | french                |
  | cooking method | oven                  |
  | effort level   | involved              |
  | flavor profile | rich, savory          |
And the user's taste profile should be updated with a moderate weight boost for each tag

Scenario: Multiple recipes reinforce preferences
Given a user has saved multiple recipes featuring the same protein
Then that protein's weight in the taste profile should increase proportionally
And weekly meal suggestions should reflect the reinforced preference
