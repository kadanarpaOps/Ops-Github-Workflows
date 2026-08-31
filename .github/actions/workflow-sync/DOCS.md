# The CI Pipeline Action

## ¿How it works?

You need to specify inside your repository the following *Repository Secrets*
- `JIRA_KEY`: The Prefix to be validated against the Jira API. *e.g. TEST*
- `JIRA_URL`: Uniform Resource Locator of your Jira Workspace. *e.g. https://test.atlassian.net*
- `JIRA_EMAIL`: Email of user responsible in Jira Workspace. *e.g. test@gmail.com*
- `JIRA_TOKEN`: Can be generated from [Jira Token Link](https://id.atlassian.com/manage-profile/security/api-tokens)
- `PROJECT_NAME`: Assigned when created the Project on Sonar
- `SONAR_URL`: Uniform Resource Locator of you Sonar Hosting
- `SONAR_TOKEN`: Unique Sonar Project Token to access the Quality Gate Validations