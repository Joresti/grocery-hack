Feature: Family member meal suggestions
As a family member of an account holder
I want to suggest replacements for meals in the weekly plan
So that I can have input on what we eat without controlling the plan

Background:
Given an account holder with an active account
And a family member linked to that account
And the account holder has a meal plan for the current week

# ---------------------------------------------------------------

# Family member: creating a suggestion

# ---------------------------------------------------------------

Scenario: Family member views the current meal plan
Given I am a family member of an account holder
When I open the current week's meal plan
Then I can see each meal in the plan
And I can see which meals already have a pending suggestion from me

Scenario: Family member suggests a meal replacement
Given I am a family member of an account holder
And the current week's meal plan contains a meal I would like to replace
When I select that meal
And I submit a suggested replacement meal
Then the suggestion is recorded as pending
And the account holder can see it in their pending suggestions
And the meal plan itself is unchanged

Scenario: Family member cannot suggest a replacement for a meal that already has a pending suggestion from them
Given I am a family member of an account holder
And I have already submitted a pending suggestion for a meal
When I view that meal in the plan
Then I cannot submit another suggestion for the same meal
And I can see my existing pending suggestion for that meal

# ---------------------------------------------------------------

# Family member: tracking suggestion status

# ---------------------------------------------------------------

Scenario: Family member views the status of their suggestions
Given I am a family member of an account holder
And I have submitted one or more suggestions
When I view my suggestions
Then I see each suggestion with its current status
And the status is one of: pending, accepted, or dismissed

# ---------------------------------------------------------------

# Account holder: reviewing suggestions

# ---------------------------------------------------------------

Scenario: Account holder views pending suggestions
Given I am an account holder
And a family member has submitted one or more suggestions
When I view my pending suggestions
Then I see each suggestion, the meal it would replace, and who suggested it

Scenario: Account holder accepts a suggestion
Given I am an account holder
And a family member has submitted a pending suggestion
When I accept that suggestion
Then the meal plan is updated to use the suggested replacement
And the suggestion is marked as accepted
And the family member can see that their suggestion was accepted

Scenario: Account holder dismisses a suggestion
Given I am an account holder
And a family member has submitted a pending suggestion
When I dismiss that suggestion
Then the meal plan is unchanged
And the suggestion is marked as dismissed
And the family member can see that their suggestion was dismissed

# ---------------------------------------------------------------

# Permissions

# ---------------------------------------------------------------

Scenario: Family member cannot directly edit the meal plan
Given I am a family member of an account holder
When I view the current week's meal plan
Then I cannot change a meal directly
And the only change I can make is to submit a suggestion

Scenario: Account holder can edit the meal plan directly
Given I am an account holder
When I view the current week's meal plan
Then I can change a meal directly without submitting a suggestion

Scenario: A family member cannot review or act on suggestions
Given I am a family member of an account holder
When I view my suggestions
Then I can see their status
But I cannot accept or dismiss any suggestion
